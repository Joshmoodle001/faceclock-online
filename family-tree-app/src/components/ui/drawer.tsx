import * as React from "react"
import { cn } from "@/lib/utils"

const Drawer = ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => {
  return (
    <>
      {open && <div className="fixed inset-0 z-50 bg-black/80" onClick={() => onOpenChange(false)} />}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background shadow-lg transition-transform duration-200",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        {children}
      </div>
    </>
  )
}

const DrawerTrigger = ({ asChild, children, onClick }: { asChild?: boolean; children: React.ReactNode; onClick?: () => void }) => {
  return <div onClick={onClick}>{children}</div>
}

const DrawerContent = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="max-h-[80vh] overflow-auto">
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {children}
    </div>
  )
}

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  )
)
DrawerTitle.displayName = "DrawerTitle"

export { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle }
