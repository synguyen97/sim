import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  authenticateCopilotRequestSessionOnly,
  createBadRequestResponse,
  createInternalServerErrorResponse,
  createRequestTracker,
  createUnauthorizedResponse,
} from "@/lib/copilot/auth";
import { getCopilotModel } from "@/lib/copilot/config";
import {
  TITLE_GENERATION_SYSTEM_PROMPT,
  TITLE_GENERATION_USER_PROMPT,
} from "@/lib/copilot/prompts";
import { env } from "@/lib/env";
import { createLogger } from "@/lib/logs/console/logger";
import { downloadFile } from "@/lib/uploads";
import { downloadFromS3WithConfig } from "@/lib/uploads/s3/s3-client";
import { S3_COPILOT_CONFIG, USE_S3_STORAGE } from "@/lib/uploads/setup";
import { db } from "@/db";
import { copilotChats } from "@/db/schema";
import { executeProviderRequest } from "@/providers";
import { createAnthropicFileContent, isSupportedFileType } from "./file-utils";

const logger = createLogger("CopilotChatAPI");

// Schema for file attachments
const FileAttachmentSchema = z.object({
  id: z.string(),
  s3_key: z.string(),
  filename: z.string(),
  media_type: z.string(),
  size: z.number(),
});

// Schema for chat messages
const ChatMessageSchema = z.object({
  message: z.string().min(1, "Message is required"),
  userMessageId: z.string().optional(), // ID from frontend for the user message
  chatId: z.string().optional(),
  workflowId: z.string().min(1, "Workflow ID is required"),
  mode: z.enum(["ask", "agent"]).optional().default("agent"),
  createNewChat: z.boolean().optional().default(false),
  stream: z.boolean().optional().default(true),
  implicitFeedback: z.string().optional(),
  fileAttachments: z.array(FileAttachmentSchema).optional(),
});

// Sim Agent API configuration
const SIM_AGENT_API_URL = env.SIM_AGENT_API_URL || "http://localhost:8000";
const SIM_AGENT_API_KEY = env.SIM_AGENT_API_KEY;

/**
 * Generate a chat title using LLM
 */
async function generateChatTitle(userMessage: string): Promise<string> {
  try {
    const { provider, model } = getCopilotModel("title");

    // Get the appropriate API key for the provider
    let apiKey: string | undefined;
    if (provider === "anthropic") {
      // Use rotating API key for Anthropic
      const { getRotatingApiKey } = require("@/lib/utils");
      try {
        apiKey = getRotatingApiKey("anthropic");
        logger.debug(`Using rotating API key for Anthropic title generation`);
      } catch (e) {
        // If rotation fails, let the provider handle it
        logger.warn(`Failed to get rotating API key for Anthropic:`, e);
      }
    }

    const response = await executeProviderRequest(provider, {
      model,
      systemPrompt: TITLE_GENERATION_SYSTEM_PROMPT,
      context: TITLE_GENERATION_USER_PROMPT(userMessage),
      temperature: 0.3,
      maxTokens: 50,
      apiKey: apiKey || "",
      stream: false,
    });

    if (typeof response === "object" && "content" in response) {
      return response.content?.trim() || "New Chat";
    }

    return "New Chat";
  } catch (error) {
    logger.error("Failed to generate chat title:", error);
    return "New Chat";
  }
}

/**
 * Generate chat title asynchronously and update the database
 */
async function generateChatTitleAsync(
  chatId: string,
  userMessage: string,
  requestId: string,
  streamController?: ReadableStreamDefaultController<Uint8Array>
): Promise<void> {
  try {
    logger.info(
      `[${requestId}] Starting async title generation for chat ${chatId}`
    );

    const title = await generateChatTitle(userMessage);

    // Update the chat with the generated title
    await db
      .update(copilotChats)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(eq(copilotChats.id, chatId));

    // Send title_updated event to client if streaming
    if (streamController) {
      const encoder = new TextEncoder();
      const titleEvent = `data: ${JSON.stringify({
        type: "title_updated",
        title: title,
      })}\n\n`;
      streamController.enqueue(encoder.encode(titleEvent));
      logger.debug(
        `[${requestId}] Sent title_updated event to client: "${title}"`
      );
    }

    logger.info(
      `[${requestId}] Generated title for chat ${chatId}: "${title}"`
    );
  } catch (error) {
    logger.error(
      `[${requestId}] Failed to generate title for chat ${chatId}:`,
      error
    );
    // Don't throw - this is a background operation
  }
}

/**
 * POST /api/copilot/chat
 * Send messages to sim agent and handle chat persistence
 */
export async function POST(req: NextRequest) {
  const tracker = createRequestTracker();

  try {
    // Get session to access user information including name
    const session = await getSession();

    if (!session?.user?.id) {
      return createUnauthorizedResponse();
    }

    const authenticatedUserId = session.user.id;

    const body = await req.json();
    const {
      message,
      userMessageId,
      chatId,
      workflowId,
      mode,
      createNewChat,
      stream,
      implicitFeedback,
      fileAttachments,
    } = ChatMessageSchema.parse(body);

    logger.info(`[${tracker.requestId}] Processing copilot chat request`, {
      userId: authenticatedUserId,
      workflowId,
      chatId,
      mode,
      stream,
      createNewChat,
      messageLength: message.length,
      hasImplicitFeedback: !!implicitFeedback,
    });

    // Handle chat context
    let currentChat: any = null;
    let conversationHistory: any[] = [];
    let actualChatId = chatId;

    if (chatId) {
      // Load existing chat
      const [chat] = await db
        .select()
        .from(copilotChats)
        .where(
          and(
            eq(copilotChats.id, chatId),
            eq(copilotChats.userId, authenticatedUserId)
          )
        )
        .limit(1);

      if (chat) {
        currentChat = chat;
        conversationHistory = Array.isArray(chat.messages) ? chat.messages : [];
      }
    } else if (createNewChat && workflowId) {
      // Create new chat
      const { provider, model } = getCopilotModel("chat");
      const [newChat] = await db
        .insert(copilotChats)
        .values({
          userId: authenticatedUserId,
          workflowId,
          title: null,
          model,
          messages: [],
        })
        .returning();

      if (newChat) {
        currentChat = newChat;
        actualChatId = newChat.id;
      }
    }

    // Process file attachments if present
    const processedFileContents: any[] = [];
    if (fileAttachments && fileAttachments.length > 0) {
      logger.info(
        `[${tracker.requestId}] Processing ${fileAttachments.length} file attachments`
      );

      for (const attachment of fileAttachments) {
        try {
          // Check if file type is supported
          if (!isSupportedFileType(attachment.media_type)) {
            logger.warn(
              `[${tracker.requestId}] Unsupported file type: ${attachment.media_type}`
            );
            continue;
          }

          // Download file from S3
          logger.info(
            `[${tracker.requestId}] Downloading file: ${attachment.s3_key}`
          );
          let fileBuffer: Buffer;
          if (USE_S3_STORAGE) {
            fileBuffer = await downloadFromS3WithConfig(
              attachment.s3_key,
              S3_COPILOT_CONFIG
            );
          } else {
            // Fallback to generic downloadFile for other storage providers
            fileBuffer = await downloadFile(attachment.s3_key);
          }

          // Convert to Anthropic format
          const fileContent = createAnthropicFileContent(
            fileBuffer,
            attachment.media_type
          );
          if (fileContent) {
            processedFileContents.push(fileContent);
            logger.info(
              `[${tracker.requestId}] Processed file: ${attachment.filename} (${attachment.media_type})`
            );
          }
        } catch (error) {
          logger.error(
            `[${tracker.requestId}] Failed to process file ${attachment.filename}:`,
            error
          );
          // Continue processing other files
        }
      }
    }

    // Build messages array for sim agent with conversation history
    const messages = [];

    // Add conversation history (need to rebuild these with file support if they had attachments)
    for (const msg of conversationHistory) {
      if (msg.fileAttachments && msg.fileAttachments.length > 0) {
        // This is a message with file attachments - rebuild with content array
        const content: any[] = [{ type: "text", text: msg.content }];

        // Process file attachments for historical messages
        for (const attachment of msg.fileAttachments) {
          try {
            if (isSupportedFileType(attachment.media_type)) {
              let fileBuffer: Buffer;
              if (USE_S3_STORAGE) {
                fileBuffer = await downloadFromS3WithConfig(
                  attachment.s3_key,
                  S3_COPILOT_CONFIG
                );
              } else {
                // Fallback to generic downloadFile for other storage providers
                fileBuffer = await downloadFile(attachment.s3_key);
              }
              const fileContent = createAnthropicFileContent(
                fileBuffer,
                attachment.media_type
              );
              if (fileContent) {
                content.push(fileContent);
              }
            }
          } catch (error) {
            logger.error(
              `[${tracker.requestId}] Failed to process historical file ${attachment.filename}:`,
              error
            );
          }
        }

        messages.push({
          role: msg.role,
          content,
        });
      } else {
        // Regular text-only message
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add implicit feedback if provided
    if (implicitFeedback) {
      messages.push({
        role: "system",
        content: implicitFeedback,
      });
    }

    // Add current user message with file attachments
    if (processedFileContents.length > 0) {
      // Message with files - use content array format
      const content: any[] = [{ type: "text", text: message }];

      // Add file contents
      for (const fileContent of processedFileContents) {
        content.push(fileContent);
      }

      messages.push({
        role: "user",
        content,
      });
    } else {
      // Text-only message
      messages.push({
        role: "user",
        content: message,
      });
    }

    // Start title generation in parallel if this is a new chat with first message
    if (
      actualChatId &&
      !currentChat?.title &&
      conversationHistory.length === 0
    ) {
      logger.info(
        `[${tracker.requestId}] Will start parallel title generation inside stream`
      );
    }

    // Forward to sim agent API
    logger.info(`[${tracker.requestId}] Sending request to sim agent API`, {
      messageCount: messages.length,
      endpoint: `${SIM_AGENT_API_URL}/api/chat-completion-streaming`,
    });

    const conversationContext = messages
      .map((msg) => {
        if (typeof msg.content === "string") {
          return `${msg.role}: ${msg.content}`;
        } else if (Array.isArray(msg.content)) {
          // Handle content array (with file attachments)
          const textContent = msg.content
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("\n");
          return `${msg.role}: ${textContent}`;
        }
        return `${msg.role}: [complex content]`;
      })
      .join("\n\n");

    // Get the latest user message content
    const latestMessage = messages[messages.length - 1];
    let userContent = "";
    if (typeof latestMessage.content === "string") {
      userContent = latestMessage.content;
    } else if (Array.isArray(latestMessage.content)) {
      userContent = latestMessage.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
    }

    // Use executeProviderRequest instead of external API
    // Force non-streaming để get complete formatted response
    const anthropicResponse = await executeProviderRequest("anthropic", {
      model: "claude-3-7-sonnet-20250219",
      systemPrompt: `You are a helpful AI assistant for Nuggets Studio workflows. 
        Your role is to guide users in building, editing, troubleshooting, and understanding their automation workflows and AI agents.

        Current mode: ${mode}
        Workflow ID: ${workflowId}
        ${session?.user?.name ? `User: ${session.user.name}` : ""}

        Your goals:
        - Understand the workflow’s current state and objectives.
        - Offer clear, step-by-step guidance for creating or modifying automation processes.
        - Suggest best practices for connecting tools, managing data flow, and structuring tasks.
        - When showing code, configurations, or structured content, use proper indentation and line breaks.
        - If relevant, provide small, testable examples before the full implementation.

        Always answer in a concise, accurate, and user-friendly manner, ensuring responses are actionable and easy to follow.`,
      context: conversationContext + `\n\nuser: ${userContent}`,
      temperature: 0.7,
      maxTokens: 4000,
      stream: false, // Force non-streaming
      apiKey: process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY_1 || "",
    });

    // Simulate streaming with proper formatting
    const transformedStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let assistantContent = '';
        if (
          anthropicResponse &&
          typeof anthropicResponse === "object" &&
          "content" in anthropicResponse &&
          typeof anthropicResponse.content === "string"
        ) {
          assistantContent = anthropicResponse.content;
        }
        
        // Send chatId first
        if (actualChatId) {
          const chatIdEvent = `data: ${JSON.stringify({
            type: "chat_id",
            chatId: actualChatId,
          })}\n\n`;
          controller.enqueue(encoder.encode(chatIdEvent));
        }

        // Title generation
        if (actualChatId && !currentChat?.title && conversationHistory.length === 0) {
          generateChatTitleAsync(actualChatId, userContent, tracker.requestId, controller).catch(
            (error) => {
              logger.error(`[${tracker.requestId}] Title generation failed:`, error);
            }
          );
        }

        try {
          // Split by lines to preserve formatting
          const lines = assistantContent.split('\n');
          let currentLine = '';
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Add the line
            currentLine = line;
            
            // Add newline if not the last line
            if (i < lines.length - 1) {
              currentLine += '\n';
            }
            
            // Send the line with proper formatting
            const contentEvent = `data: ${JSON.stringify({
              type: "content",
              data: currentLine,
            })}\n\n`;
            controller.enqueue(encoder.encode(contentEvent));
            
            // Small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          // Send done event
          const doneEvent = `data: ${JSON.stringify({
            type: "done",
          })}\n\n`;
          controller.enqueue(encoder.encode(doneEvent));

          // Save to database với full formatted content
          if (currentChat) {
            const userMessage = {
              id: userMessageId || crypto.randomUUID(),
              role: "user",
              content: userContent,
              timestamp: new Date().toISOString(),
              ...(fileAttachments && fileAttachments.length > 0 && { fileAttachments }),
            };

            const assistantMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: assistantContent, // Full formatted content
              timestamp: new Date().toISOString(),
            };

            const updatedMessages = [...conversationHistory, userMessage, assistantMessage];

            await db
              .update(copilotChats)
              .set({
                messages: updatedMessages,
                updatedAt: new Date(),
              })
              .where(eq(copilotChats.id, actualChatId!));
          }

        } catch (error) {
          logger.error(`[${tracker.requestId}] Error processing stream:`, error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(transformedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const duration = tracker.getDuration();

    if (error instanceof z.ZodError) {
      logger.error(`[${tracker.requestId}] Validation error:`, {
        duration,
        errors: error.errors,
      });
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    logger.error(`[${tracker.requestId}] Error handling copilot chat:`, {
      duration,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workflowId = searchParams.get("workflowId");

    if (!workflowId) {
      return createBadRequestResponse("workflowId is required");
    }

    // Get authenticated user using consolidated helper
    const { userId: authenticatedUserId, isAuthenticated } =
      await authenticateCopilotRequestSessionOnly();
    if (!isAuthenticated || !authenticatedUserId) {
      return createUnauthorizedResponse();
    }

    // Fetch chats for this user and workflow
    const chats = await db
      .select({
        id: copilotChats.id,
        title: copilotChats.title,
        model: copilotChats.model,
        messages: copilotChats.messages,
        createdAt: copilotChats.createdAt,
        updatedAt: copilotChats.updatedAt,
      })
      .from(copilotChats)
      .where(
        and(
          eq(copilotChats.userId, authenticatedUserId),
          eq(copilotChats.workflowId, workflowId)
        )
      )
      .orderBy(desc(copilotChats.updatedAt));

    // Transform the data to include message count
    const transformedChats = chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      model: chat.model,
      messages: Array.isArray(chat.messages) ? chat.messages : [],
      messageCount: Array.isArray(chat.messages) ? chat.messages.length : 0,
      previewYaml: null, // Not needed for chat list
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }));

    logger.info(
      `Retrieved ${transformedChats.length} chats for workflow ${workflowId}`
    );

    return NextResponse.json({
      success: true,
      chats: transformedChats,
    });
  } catch (error) {
    logger.error("Error fetching copilot chats:", error);
    return createInternalServerErrorResponse("Failed to fetch chats");
  }
}
