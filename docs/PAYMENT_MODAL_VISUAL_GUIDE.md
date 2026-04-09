# Premium Payment Modal - Visual Layout Guide

## Desktop View (Max Width: 42rem / 672px)

```
┌─────────────────────────────────────────────────────────────┐
│                      DIALOG HEADER                           │
│  Secure Payment                                              │
│  Review your booking and complete the secure payment        │
├─────────────────────────────────────────────────────────────┤
│  SCROLL AREA CONTENT:                                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔒 100% Secure Payments                             │   │
│  │ Powered by Razorpay & Stripe                        │   │
│  │ [PCI DSS Level 1] [256-bit SSL]                     │   │
│  │ Your payment details are encrypted and safe         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📍 BOOKING SUMMARY                                  │   │
│  │ Booking Type: Hotel                                 │   │
│  │ Location: Mumbai, India                             │   │
│  │ Dates: Apr 15 → Apr 20 (5 nights)                   │   │
│  │ Guests: 2                                            │   │
│  │ Rooms: 1                                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 💳 PRICE BREAKDOWN                           ▼ MORE │   │
│  │ Base Fare              ₹1,20,000                    │   │
│  │ Taxes (5%)             ₹6,000                       │   │
│  │ Service Fee (3%)       ₹3,600                       │   │
│  │ ────────────────────────────────────────────────────│   │
│  │ Total Amount           ₹1,29,600                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⏰ Free cancellation until 24 hours before check-in │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  CHOOSE PAYMENT METHOD                                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ◉ UPI              Fast & secure via UPI      ▼     │   │
│  │                                                      │   │
│  │   Select UPI App:                                    │   │
│  │   [🟠 Google Pay] [🔵 PhonePe] [🟦 Paytm] [🟩 BHIM] │   │
│  │                                                      │   │
│  │   UPI ID:                                            │   │
│  │   [yourname@upi........................]             │   │
│  │   Format: 9876543210@ybl or username@paytm          │   │
│  │                                                      │   │
│  │   [Pay via Google Pay]                               │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ◯ Credit/Debit Card  Visa, MasterCard, RuPay  ▼    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ◯ Net Banking         Direct bank transfer     ▼    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                      STICKY FOOTER                           │
│  [🔒 Pay ₹1,29,600 Securely]                [Processing...] │
│  Your payment is protected by 256-bit SSL encryption        │
└─────────────────────────────────────────────────────────────┘
```

---

## UPI Payment Expanded

```
┌────────────────────────────────────────┐
│ ◉ UPI - Fast & secure via UPI          │
│
│ Select UPI App:
│ ┌─────────────┐ ┌─────────────┐
│ │ 🟠 Google   │ │ 🔵 PhonePe  │
│ │    Pay      │ │             │
│ └─────────────┘ └─────────────┘
│ ┌─────────────┐ ┌─────────────┐
│ │ 🟦 Paytm    │ │ 🟩 BHIM     │
│ └─────────────┘ └─────────────┘
│
│ UPI ID:
│ [yourname@upi        ✓]
│ Format: 9876543210@ybl, username@paytm
│
│ [🔒💳 Pay via Google Pay]
│
└────────────────────────────────────────┘
```

---

## Card Payment Expanded

```
┌────────────────────────────────────────┐
│ ◉ Credit/Debit Card - Visa, MC, RuPay │
│
│ ◉ Credit Card  ◯ Debit Card
│
│ Card Number:
│ [1234 5678 9012 3456         💳]
│
│ Card Holder Name:
│ [John Doe                        ]
│
│ Expiry:          CVV:
│ [MM/YY    ]      [••• 👁]
│
│ ☐ Save for future bookings
│
│ [🔒💳 Pay with Card]
│
└────────────────────────────────────────┘
```

---

## Success State

```
┌──────────────────────────────────────┐
│  ✅ DIALOG HEADER                    │
│  ✨ Payment Successful               │
│  Your booking is confirmed           │
├──────────────────────────────────────┤
│                                      │
│         ✨ [✓]                       │
│              ✨                      │
│                                      │
│    Payment Successful 🎉             │
│   Your booking is confirmed          │
│                                      │
│  A confirmation email has been sent  │
│  to john@example.com                 │
│                                      │
│  (Auto-closes in 2 seconds)          │
│                                      │
└──────────────────────────────────────┘
```

---

## Error State

```
┌──────────────────────────────────────┐
│  Secure Payment                      │
│  Review your booking...              │
├──────────────────────────────────────┤
│                                      │
│ ⚠️ PAYMENT FAILED                    │
│ Invalid UPI ID format.               │
│ Please try again.                    │
│ [Dismiss]                            │
│                                      │
│ UPI ID:                              │
│ [invalid-upi-id    ✗]                │
│ ✗ Invalid UPI ID format              │
│                                      │
│ Format: 9876543210@ybl, username@.. │
│                                      │
│ [Try Again]                          │
│                                      │
└──────────────────────────────────────┘
```

---

## Processing State

```
┌──────────────────────────────────────┐
│  Secure Payment                      │
│  Complete the secure payment...      │
├──────────────────────────────────────┤
│  (Everything disabled)               │
│                                      │
│  UPI ID:                             │
│  [yourname@upi        (disabled)]    │
│                                      │
│  Select UPI App:                     │
│  [🟠 Google Pay (disabled)]           │
│                                      │
│  ...                                 │
│                                      │
├──────────────────────────────────────┤
│  [⟳ Processing Payment...] (disabled)│
│  Your payment is protected...        │
└──────────────────────────────────────┘
```

---

## Mobile View (375px width)

```
┌────────────────────────────────────┐
│  Secure Payment                    │
├────────────────────────────────────┤
│  SCROLL CONTENT:                   │
│                                    │
│  ┌──────────────────────────────┐ │
│  │🔒 100% Secure Payments       │ │
│  │Powered by trusted gateway    │ │
│  │[PCI DSS] [256-bit SSL]       │ │
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐ │
│  │📍 BOOKING SUMMARY            │ │
│  │Booking: Hotel                │ │
│  │Location: Mumbai              │ │
│  │Dates: Apr 15 → 20 (5 nights) │ │
│  │Guests: 2 | Rooms: 1          │ │
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐ │
│  │💳 PRICE BREAKDOWN         ▼  │ │
│  │Base: ₹1,20,000               │ │
│  │Tax: ₹6,000                   │ │
│  │Fee: ₹3,600                   │ │
│  │────────────────────────────  │ │
│  │Total: ₹1,29,600              │ │
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐ │
│  │⏰ Free cancellation until    │ │
│  │24 hours before check-in      │ │
│  └──────────────────────────────┘ │
│                                    │
│  PAYMENT METHOD (Full Width):      │
│                                    │
│  ┌──────────────────────────────┐ │
│  │◉ UPI  Fast & secure   ▼      │ │
│  │                              │ │
│  │UPI Apps:                     │ │
│  │┌──────────┐ ┌──────────┐    │ │
│  ││ 🟠 GPay  │ │ 🔵 PhonePe   │ │
│  │└──────────┘ └──────────┘    │ │
│  │┌──────────┐ ┌──────────┐    │ │
│  ││ 🟦 Paytm │ │ 🟩 BHIM  │    │ │
│  │└──────────┘ └──────────┘    │ │
│  │                              │ │
│  │UPI ID:                       │ │
│  │[yourname@upi.....       ]    │ │
│  │Format: 9876..@ybl           │ │
│  │                              │ │
│  │[🔒 Pay via GPay]             │ │
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐ │
│  │◯ Credit/Debit   Card    ▼    │ │
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐ │
│  │◯ Net Banking         Bank ▼  │ │
│  └──────────────────────────────┘ │
│                                    │
├────────────────────────────────────┤
│ [🔒 Pay ₹1,29,600 Securely]       │
│ Payment protected by SSL           │
└────────────────────────────────────┘
```

---

## Color Scheme

### Trust Section (Green)
- Background: `bg-gradient-to-r from-green-50 to-emerald-50`
- Border: `border-green-200`
- Icon: `text-green-600`
- Text: `text-green-700`

### Booking Summary (Blue)
- Background: `bg-blue-50`
- Border: `border-blue-200`
- Icon: `text-blue-600`

### Price Breakdown (Neutral)
- Text: `text-gray-700`
- Total: `text-blue-600` (bold)

### CTA Button (Blue)
- Background: `bg-blue-600`
- Hover: `hover:bg-blue-700`
- Text: `text-white`

### Error State (Red)
- Background: `bg-red-50`
- Border: `border-red-500`
- Text: `text-red-700`

### Selected Payment (Blue Ring)
- Ring: `ring-2 ring-blue-500`

---

## Component Sizes

### Modal
- Max width: 42rem (672px)
- Responsive down to mobile

### Buttons
- Height: 12px (3rem) - standard
- Height: 48px (3rem) on CTA - easy to tap
- Padding: 16px (1rem) horizontal

### Input Fields
- Height: 40px (2.5rem)
- Padding: 8px (0.5rem)
- Font size: 14px (0.875rem)
- Min tap target: 44px

### Icons
- Small: 16px (h-4 w-4)
- Medium: 20px (h-5 w-5)
- Large: 24px (h-6 w-6)
- Hero: 96px (h-24 w-24)

---

## Spacing System

```
Trust Section:        p-4 (16px padding)
Booking Summary:      p-4 inside card
Price Breakdown:      p-4 inside card
Payment Methods:      gap-3 between items
Form Fields:          space-y-4 (16px vertical)
Modal Content:        space-y-6 (24px between sections)
Footer Gap:           pt-4 (16px top padding)
```

---

## Typography Hierarchy

```
Modal Title:          text-2xl font-bold
Section Header:       text-lg font-semibold
Label:                text-sm font-medium
Body Copy:            text-sm
Helper Text:          text-xs text-muted-foreground
Button Text:          text-base font-semibold
Error Message:        text-xs text-red-500
```

---

## Interactions

### Hover States
- Payment method button: `hover:bg-muted/50`
- CTA button: `hover:bg-blue-700`
- Card input: `focus:ring-2 ring-blue-500`

### Active/Selected States
- Selected UPI app: `variant="default"` (filled)
- Unselected UPI app: `variant="outline"` (border)
- Selected payment method: `ring-2 ring-blue-500`

### Focus States
- All inputs: `focus:ring-2 ring-blue-500`
- All buttons: `focus:outline-none focus:ring-2`

### Disabled States
- During processing: `disabled` with opacity change
- Invalid input: `border-red-500`

---

## Animations

### On Success
```
✓ Checkmark animation (ping + scale)
✓ Auto-close after 2 seconds
✓ Smooth fade out transition
```

### On Processing
```
⟳ Spinner rotation (animate-spin)
✓ Button text changes
✓ All inputs fade (opacity-50)
```

### On Error
```
⚠️ Box-shadow pulse
✓ Message slide in
✓ Error highlight on field
```

### Smooth Transitions
```
✓ Collapsible sections (smooth height)
✓ Modal appearance (fast)
✓ Button state changes (instant + 200ms)
```

---

## Responsiveness Breakpoints

### Desktop (≥1024px / lg)
- Full modal width
- 2-column layout (if needed)
- All features visible

### Tablet (640px - 1023px / md - lg)
- Slightly narrower
- Single column
- Full-width buttons

### Mobile (< 640px / sm)
- Max modal height: 90vh
- Single column
- Full-width inputs
- Large tap targets (48px+)
- Sticky CTA always visible
- No horizontal scroll

---

## Accessibility Features

### Keyboard
- Tab: Move to next element
- Shift+Tab: Move to previous element
- Enter: Activate buttons/submit
- Space: Toggle checkboxes/radio buttons
- Esc: Close modal

### Screen Reader
- Form labels: `<label htmlFor="...">` properly associated
- Error messages: `aria-invalid="true"` + `aria-describedby`
- Button roles: Clear purpose communicated
- Focus areas: Announced on change

### Visual
- Color contrast: WCAG AA (4.5:1 or 3:1 for large text)
- Focus indicators: Blue ring visible
- Error colors: Not just red (+ icon)
- Text size: Min 14px for readability

---

**This visual guide complements the component code.**
**For detailed implementation, see `PremiumPaymentModal.tsx`**
