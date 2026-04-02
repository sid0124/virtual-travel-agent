'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4 sm:gap-8',
        month: 'space-y-4 w-[280px]', // Restored fixed width to prevent table-fixed collapse
        month_caption: 'relative flex h-10 items-center justify-center px-8',
        caption_label: 'text-sm font-semibold',
        dropdowns: 'flex items-center justify-center gap-1 mx-2',
        dropdown_root: 'relative inline-flex items-center',
        dropdown: cn(
          'appearance-none rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none'
        ),
        nav: 'flex items-center justify-between absolute inset-x-0 top-1 z-10 px-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 transition-opacity'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 transition-opacity'
        ),

        // Native table semantics for perfect alignment
        month_grid: 'w-full border-collapse border-none table-fixed',
        weekdays: 'table-row',
        weekday:
          'h-10 w-10 p-0 text-center align-middle text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider',
        weeks: 'table-row-group',
        week: 'table-row',
        day: cn(
          'relative h-10 w-10 p-0 text-center align-middle text-sm focus-within:relative focus-within:z-20',
          '[&:has([aria-selected])]:bg-accent/50',
          '[&:has([aria-selected].day-range-end)]:rounded-r-md',
          'first:[&:has([aria-selected])]:rounded-l-md',
          'last:[&:has([aria-selected])]:rounded-r-md'
        ),
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors'
        ),
        selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-semibold shadow-sm',
        today: 'bg-accent/20 text-accent-foreground font-bold border-b-2 border-primary',
        outside:
          'text-muted-foreground/30 opacity-50 aria-selected:bg-accent/40 aria-selected:text-muted-foreground',
        disabled: 'cursor-not-allowed text-muted-foreground/20 opacity-30',
        range_start: 'day-range-start',
        range_end: 'day-range-end',
        range_middle:
          'aria-selected:bg-accent/50 aria-selected:text-accent-foreground',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}

Calendar.displayName = 'Calendar'

export { Calendar }
