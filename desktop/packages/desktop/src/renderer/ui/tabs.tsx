import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from './cn';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-[10px] border border-sv-line bg-sv-surface p-0.5',
        className
      )}
      {...props}
    />
  );
});

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex h-6 items-center rounded-[7px] bg-transparent px-2.5 text-[11.5px] text-sv-muted outline-none transition-colors data-[state=active]:bg-sv-raised data-[state=active]:text-sv-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-sv-focus',
        className
      )}
      {...props}
    />
  );
});
