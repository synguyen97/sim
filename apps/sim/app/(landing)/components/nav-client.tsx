"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useBrandConfig } from "@/lib/branding/branding";
import { usePrefetchOnHover } from "@/app/(landing)/utils/prefetch";

// --- Framer Motion Variants ---
const desktopNavContainerVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.2,
      duration: 0.3,
    },
  },
};

const mobileSheetContainerVariants = {
  hidden: { x: "100%" },
  visible: {
    x: 0,
    transition: { duration: 0.3 },
  },
  exit: {
    x: "100%",
    transition: { duration: 0.2 },
  },
};

const mobileNavItemsContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const mobileNavItemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 },
  },
};

const mobileButtonVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};
// --- End Framer Motion Variants ---

// Component for Navigation Links
const NavLinks = ({
  mobile,
  currentPath,
  onContactClick,
}: {
  mobile?: boolean;
  currentPath?: string;
  onContactClick?: () => void;
}) => {
  const navigationLinks = [
    // { href: "/", label: "Marketplace" },
    ...(currentPath !== "/" ? [{ href: "/", label: "Home" }] : []),
    { href: "https://docs.sim.ai/", label: "Docs", external: true },
    // { href: '/', label: 'Blog' },
    { href: "/contributors", label: "Contributors" },
  ];

  const handleContributorsHover = usePrefetchOnHover();

  // Common CSS class for navigation items
  const navItemClass = `text-white/60 hover:text-white/100 text-base ${
    mobile ? "p-2.5 text-lg font-medium text-left" : "p-1.5"
  } rounded-md transition-colors duration-200 block md:inline-block`;

  return (
    <>
      {navigationLinks.map((link) => {
        const linkElement = (
          <motion.div
            variants={mobile ? mobileNavItemVariants : undefined}
            key={link.label}
          >
            <Link
              href={link.href}
              className={navItemClass}
              onMouseEnter={
                link.label === "Contributors"
                  ? handleContributorsHover
                  : undefined
              }
              {...(link.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              {link.label}
            </Link>
          </motion.div>
        );

        // Wrap the motion.div with SheetClose if mobile
        return mobile ? (
          <SheetClose asChild key={link.label}>
            {linkElement}
          </SheetClose>
        ) : (
          linkElement
        );
      })}

      {/* Enterprise button with the same action as contact */}
      {onContactClick &&
        (mobile ? (
          <SheetClose asChild key="enterprise">
            <motion.div variants={mobileNavItemVariants}>
              <Link
                href="https://form.typeform.com/to/jqCO12pF"
                target="_blank"
                rel="noopener noreferrer"
                className={navItemClass}
              >
                Enterprise
              </Link>
            </motion.div>
          </SheetClose>
        ) : (
          <motion.div
            variants={mobile ? mobileNavItemVariants : undefined}
            key="enterprise"
          >
            <Link
              href="https://form.typeform.com/to/jqCO12pF"
              target="_blank"
              rel="noopener noreferrer"
              className={navItemClass}
            >
              Enterprise
            </Link>
          </motion.div>
        ))}
    </>
  );
};

interface NavClientProps {
  children: React.ReactNode;
  initialIsMobile?: boolean;
  currentPath?: string;
  onContactClick?: () => void;
}

export default function NavClient({
  children,
  initialIsMobile,
  currentPath,
  onContactClick,
}: NavClientProps) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(initialIsMobile ?? false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const _router = useRouter();
  const brand = useBrandConfig();

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();

    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle initial loading state - don't render anything that could cause layout shift
  // until we've measured the viewport
  if (!mounted) {
    return (
      <nav className="absolute top-1 right-0 left-0 z-30 px-4 py-8">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex-1">
            <div className="h-[32px] w-[32px]" />
          </div>
          <div className="flex flex-1 justify-end">
            <div className="h-[43px] w-[43px]" />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="absolute top-1 right-0 left-0 z-30 px-4 py-8">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex flex-1 items-center">
          <div className="inline-block">
            <Link href="/" className="inline-flex">
              {brand.logoUrl ? (
                <img
                  src={brand.logoUrl}
                  alt={`${brand.name} Logo`}
                  width={42}
                  height={42}
                  className="h-[42px] w-[42px] object-contain"
                />
              ) : (
                <Image
                  src="/nuggets-light-logo.png"
                  alt={`${brand.name} Logo`}
                  width={130}
                  height={42}
                />
              )}
            </Link>
          </div>
        </div>
        {isMobile && <div className="flex-1" />}

        <div className="flex flex-1 items-center justify-end">
          <div className={`flex items-center ${isMobile ? "gap-2" : "gap-3"}`}>
            {!isMobile && <></>}
          </div>
        </div>
      </div>
    </nav>
  );
}
