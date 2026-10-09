import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ModalSheetHeaderProps = {
  title: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function ModalSheetHeader({
  title,
  description,
  eyebrow,
  className,
  titleClassName,
  descriptionClassName
}: ModalSheetHeaderProps) {
  const { t } = useTranslation();

  return (
    <>
      <SheetHeader className={cn("modal-head", className)}>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <SheetTitle className={titleClassName}>{title}</SheetTitle>
        <SheetDescription className={descriptionClassName}>
          {description}
        </SheetDescription>
      </SheetHeader>
      <SheetClose asChild>
        <Button
          className="button-icon modal-sheet-close"
          title={t("Close")}
          aria-label={t("Close")}
        >
          <X size={15} />
        </Button>
      </SheetClose>
    </>
  );
}
