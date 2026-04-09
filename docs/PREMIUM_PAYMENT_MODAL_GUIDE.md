# Premium Payment Modal - Integration Guide

## Overview
The `PremiumPaymentModal` component provides production-grade payment UI with enterprise-level features including trust signals, price breakdown, booking summary, and comprehensive error handling.

## Key Features

### ✅ Trust & Security
- SSL/TLS encryption badges
- PCI DSS compliance indicators
- "100% Secure Payments" banner
- Trust-building copy

### ✅ Price Breakdown
- Base fare, taxes, service fees
- Collapsible section for cleaner UX
- Real-time calculations
- Multi-currency support

### ✅ Booking Summary
- Travel dates, location, guests
- Duration and room count
- Quick reference inside modal
- Prevents double-booking mistakes

### ✅ Smart CTA
- Dynamic amount display
- Always visible (sticky footer)
- States: idle, processing, success, error
- Clear payment method info

### ✅ Payment States
- **Idle**: Ready for input
- **Processing**: Spinner + disabled inputs
- **Success**: Confirmation screen + auto-close
- **Error**: Detailed error messages + retry

### ✅ Error Handling
- UPI ID format validation (regex-based)
- Card number validation (Luhn algorithm ready)
- Expiry date validation
- CVV validation
- Field-level error messages
- Clear, actionable error text

### ✅ UX Improvements
- Collapsible payment methods
- Radio buttons for clear selection
- Visual feedback for selected method
- Remember last selected method (via state)
- Auto-suggest popular apps
- Smooth transitions
- Mobile-responsive design

## Component Props

```typescript
interface PaymentModalProps {
  open: boolean                    // Modal visibility state
  onOpenChange: (open: boolean) => void  // Handle modal open/close
  bookingDetails: {
    checkIn: string                     // YYYY-MM-DD format
    checkOut: string                    // YYYY-MM-DD format
    guests: number
    rooms: number
    travelerName: string
    email: string
    phone: string
  }
  selectedItem: {
    name?: string
    type?: string                 // "hotel", "flight", etc.
    price: number                 // Base price
    currency: string              // "INR", "USD", etc.
    rating?: number
    address?: string              // Location details
    departure?: string            // For flights
    arrival?: string              // For flights
    duration?: string             // For flights
  }
  onPaymentSubmit?: (details: any) => Promise<boolean>  // Handle payment
  onClose?: () => void            // Called after successful payment
}
```

## Basic Integration

### 1. Import the Component

```typescript
import { PremiumPaymentModal } from '@/components/booking/PremiumPaymentModal'
import { usePaymentModal } from '@/hooks/use-payment-modal'
```

### 2. Setup State in Your Booking Component

```typescript
const [showPaymentModal, setShowPaymentModal] = useState(false)

const handlePaymentSubmit = async (paymentData: any) => {
  try {
    // Call your payment API
    const response = await fetch('/api/payment/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: paymentData.method,
        amount: paymentData.amount,
        currency: paymentData.currency,
        details: paymentData.details,
      }),
    })

    const result = await response.json()
    return result.success  // Return boolean
  } catch (error) {
    console.error('Payment error:', error)
    return false
  }
}
```

### 3. Add Modal to Your JSX

```typescript
<PremiumPaymentModal
  open={showPaymentModal}
  onOpenChange={setShowPaymentModal}
  bookingDetails={{
    checkIn: bookingDetails.checkIn,
    checkOut: bookingDetails.checkOut,
    guests: bookingDetails.guests,
    rooms: bookingDetails.rooms,
    travelerName: bookingDetails.travelerName,
    email: bookingDetails.email,
    phone: bookingDetails.phone,
  }}
  selectedItem={{
    name: selectedItem?.name,
    type: 'hotel', // or 'flight', 'package', etc.
    price: selectedItem?.price || 0,
    currency: selectedItem?.currency || 'INR',
    address: selectedItem?.location,
    rating: selectedItem?.rating,
  }}
  onPaymentSubmit={handlePaymentSubmit}
  onClose={() => {
    // Handle post-payment actions
    // e.g., redirect to confirmation page
    router.push('/booking/confirmation')
  }}
/>
```

### 4. Trigger Payment Modal

```typescript
<Button onClick={() => setShowPaymentModal(true)}>
  Proceed to Payment
</Button>
```

## Advanced Usage

### Using the Payment Modal Hook

```typescript
const paymentModal = usePaymentModal()

// Update payment details
paymentModal.updatePaymentDetail('upiId', 'user@googleplay')

// Add validation error
paymentModal.addError('upiId', 'Invalid UPI ID format')

// Check validation
const isValid = paymentModal.validateUPI(paymentModal.paymentDetails.upiId)

// Reset form
paymentModal.reset()
```

### Custom Error Handling

```typescript
const handlePaymentSubmit = async (paymentData: any) => {
  try {
    const response = await fetch('/api/payment/process', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    })

    if (!response.ok) {
      const error = await response.json()
      
      // Show specific error based on payment method
      if (paymentData.method === 'upi' && error.code === 'TIMEOUT') {
        // Handle UPI timeout
        return false
      }
      
      // Generic error
      return false
    }

    return true
  } catch (error) {
    console.error('Network error:', error)
    return false
  }
}
```

## Styling & Customization

### Override Dialog Width
The modal uses Shadcn's `Dialog` component and supports standard Shadcn customization:

```typescript
// In your DialogContent if you modify the component
<DialogContent className="max-w-3xl">  {/* Wider modal */}
```

### Customize Colors
All colors use Tailwind classes and can be overridden:

```tsx
// Green trust signals
<div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50">
// Blue price breakdown
<span className="text-blue-600">
// Yellow cancellation info
<Alert className="border-yellow-200 bg-yellow-50">
```

## Payment Methods Supported

### 1. UPI (India)
- Google Pay
- PhonePe
- Paytm
- BHIM
- Custom support

### 2. Credit/Debit Card
- Visa
- MasterCard
- RuPay
- American Express

### 3. Net Banking
- HDFC, ICICI, Axis, SBI, PNB, etc.
- Extensible dropdown

### 4. Digital Wallets (Extensible)
- Google Pay
- PhonePe
- Paytm
- Amazon Pay

## Backend Integration

### Expected API Response Format

```typescript
// POST /api/payment/process
Request:
{
  method: 'upi' | 'card' | 'netbanking' | 'wallet',
  amount: number,
  currency: 'INR' | 'USD',
  details: {
    // UPI
    upiId?: string,
    selectedUpiApp?: string,
    
    // Card
    cardNumber?: string,
    cardName?: string,
    expiry?: string,
    cvv?: string,
    
    // Net Banking
    netBankingBank?: string,
  }
}

Response:
{
  success: boolean,
  transactionId: string,
  message: string,
  code?: string  // Error code if failed
}
```

## Security Best Practices

### Frontend (Already Implemented)
✅ Input validation for all fields
✅ CVV masked in input
✅ No payment secrets stored in state
✅ Encrypted communication (HTTPS)
✅ Clear error messages (no data leaks)

### Backend (Your Implementation)
- Never log full card numbers
- Use PCI DSS compliant payment gateway (Razorpay, Stripe, etc.)
- Validate amounts server-side
- Implement rate limiting
- Use webhook signatures for verification
- Tokenize payment methods for recurring payments

## Performance Optimizations

1. **Lazy Load Modal**
   ```typescript
   const PremiumPaymentModal = dynamic(
     () => import('@/components/booking/PremiumPaymentModal'),
     { loading: () => <div>Loading...</div>, ssr: false }
   )
   ```

2. **Debounce Validation**
   ```typescript
   const debouncedValidate = useCallback(
     debounce((value: string) => validateUPIId(value), 500),
     []
   )
   ```

3. **Memoize Price Calculations**
   ```typescript
   const priceBreakdown = useMemo(
     () => calculatePriceBreakdown(selectedItem.price),
     [selectedItem.price]
   )
   ```

## Accessibility

✅ ARIA labels on all inputs
✅ Keyboard navigation support
✅ Focus management
✅ Screen reader friendly
✅ Color contrast compliant
✅ Mobile touch-friendly buttons

## Testing Checklist

- [ ] Payment modal opens/closes correctly
- [ ] Booking summary displays accurate data
- [ ] Price breakdown calculations are correct
- [ ] UPI ID validation works (test cases below)
- [ ] Card number validation works
- [ ] Expiry date validation works
- [ ] CVV validation works
- [ ] Error messages display correctly
- [ ] Success state shows confirmation
- [ ] Modal closes after successful payment
- [ ] Modal responsive on mobile
- [ ] Sticky footer visible while scrolling
- [ ] Trust signals display on all payment methods
- [ ] Free cancellation info is visible

### UPI ID Test Cases
```
✅ Valid:   9876543210@ybl
✅ Valid:   user@paytm
✅ Valid:   test.user@okhdfcbank
✗ Invalid: 12345
✗ Invalid: @ybl
✗ Invalid: user@
```

### Card Number Test Cases
```
✅ Valid:   4532015112830366 (Visa)
✅ Valid:   5425233010103442 (MC)
✗ Invalid: 123
✗ Invalid: 0000000000000003
```

## Migration from Old Component

### Before
```typescript
{bookingStep === "payment" && (
  <div className="space-y-4">
    <Label>Select Payment Method</Label>
    {/* Basic payment UI */}
  </div>
)}
```

### After
```typescript
<PremiumPaymentModal
  open={showPaymentModal}
  onOpenChange={setShowPaymentModal}
  bookingDetails={bookingDetails}
  selectedItem={selectedItem}
  onPaymentSubmit={handlePaymentSubmit}
/>
```

## Troubleshooting

### Modal not closing after payment
- Ensure `onPaymentSubmit` returns `true` on success
- Check that `onOpenChange` properly sets state

### Validation not working
- Verify regex patterns match your requirements
- Check that error state is being set

### Price calculation incorrect
- Verify `selectedItem.price` is a number
- Check tax/fee percentages in `calculatePriceBreakdown`

### Styling issues
- Ensure Shadcn components are installed
- Check Tailwind CSS is configured
- Verify dark mode support if needed

## Future Enhancements

- [ ] International payment methods
- [ ] Apple Pay / Google Pay wallet integration
- [ ] Installment payment options
- [ ] Cryptocurrency payments
- [ ] Saved payment methods feature
- [ ] One-click checkout
- [ ] Multi-currency support
- [ ] Real 3D Secure integration
- [ ] Payment analytics dashboard
- [ ] Promo code integration

## Support & Maintenance

The component is built with:
- React 18+ 
- Next.js 13+
- TypeScript
- Tailwind CSS
- Shadcn/ui components

No external payment SDKs included (keep backend separate for security).
