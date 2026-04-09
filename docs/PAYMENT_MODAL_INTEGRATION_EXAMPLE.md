/**
 * PREMIUM PAYMENT MODAL - INTEGRATION EXAMPLE
 * 
 * This file shows how to integrate the PremiumPaymentModal into your booking page.
 * Replace the old payment logic with this implementation.
 */

'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PremiumPaymentModal } from '@/components/booking/PremiumPaymentModal'

// ============================================================================
// EXAMPLE INTEGRATION IN YOUR BOOKING PAGE
// ============================================================================

export function BookingPageWithPremiumPayment() {
  const router = useRouter()
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  /**
   * Booking details state - from your form
   */
  const [bookingDetails, setBookingDetails] = useState({
    checkIn: '2024-04-15',
    checkOut: '2024-04-20',
    guests: 2,
    rooms: 1,
    travelerName: 'John Doe',
    email: 'john@example.com',
    phone: '+91-9876543210',
  })

  /**
   * Selected item (hotel, flight, etc.)
   */
  const [selectedItem, setSelectedItem] = useState({
    name: 'Taj Mahal Hotel',
    type: 'hotel',
    price: 120000,
    currency: 'INR',
    rating: 4.8,
    address: 'Mumbai, India',
    departure: null,
    arrival: null,
    duration: null,
  })

  /**
   * Handle payment submission
   * This is called when user clicks "Pay" button in the modal
   */
  const handlePaymentSubmit = async (paymentData: {
    method: string
    details: any
    amount: number
    currency: string
  }): Promise<boolean> => {
    try {
      console.log('Processing payment:', paymentData)

      // 1. Call your backend payment API
      const response = await fetch('/api/payment/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: `BOOKING_${Date.now()}`,
          method: paymentData.method,
          amount: paymentData.amount,
          currency: paymentData.currency,
          customerEmail: bookingDetails.email,
          customerPhone: bookingDetails.phone,
          details: paymentData.details,

          // Include booking context
          booking: {
            hotel: selectedItem.name,
            checkIn: bookingDetails.checkIn,
            checkOut: bookingDetails.checkOut,
            guests: bookingDetails.guests,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Payment failed:', error)
        return false
      }

      const result = await response.json()

      // 2. Payment successful - store confirmation
      if (result.success) {
        // Store booking confirmation in session/database
        sessionStorage.setItem(
          'bookingConfirmation',
          JSON.stringify({
            bookingId: result.bookingId || `BOOKING_${Date.now()}`,
            transactionId: result.transactionId,
            amount: paymentData.amount,
            currency: paymentData.currency,
            method: paymentData.method,
            timestamp: new Date().toISOString(),
          })
        )

        return true
      }

      return false
    } catch (error) {
      console.error('Payment error:', error)
      return false
    }
  }

  /**
   * Handle successful payment completion
   */
  const handlePaymentClose = () => {
    // Redirect to confirmation page or dashboard
    router.push('/booking/confirmation')
  }

  /**
   * Open payment modal
   */
  const handleProceedToPayment = () => {
    // Validate booking details before opening modal
    if (
      !bookingDetails.checkIn ||
      !bookingDetails.checkOut ||
      !bookingDetails.travelerName ||
      !bookingDetails.email
    ) {
      alert('Please fill in all booking details first')
      return
    }

    setShowPaymentModal(true)
  }

  return (
    <div className="space-y-4">
      {/* Your booking form or display */}
      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-bold mb-4">Booking Summary</h2>
        <p>Hotel: {selectedItem.name}</p>
        <p>Check-in: {bookingDetails.checkIn}</p>
        <p>Check-out: {bookingDetails.checkOut}</p>
        <p>Guests: {bookingDetails.guests}</p>
      </div>

      {/* Trigger button */}
      <button
        onClick={handleProceedToPayment}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Proceed to Payment
      </button>

      {/* Premium Payment Modal */}
      <PremiumPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        bookingDetails={bookingDetails}
        selectedItem={selectedItem}
        onPaymentSubmit={handlePaymentSubmit}
        onClose={handlePaymentClose}
      />
    </div>
  )
}

// ============================================================================
// BACKEND API ROUTE EXAMPLE
// ============================================================================

/**
 * File: app/api/payment/process/route.ts
 * 
 * This shows how to handle the payment request from the frontend
 */

export const exampleBackendRoute = `
import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

// Initialize payment gateway
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()

    const {
      bookingId,
      method,
      amount,
      currency,
      customerEmail,
      customerPhone,
      details,
      booking,
    } = payload

    // 1. Validate payment amount
    if (!amount || amount < 100) {
      return NextResponse.json(
        { success: false, message: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    // 2. Process payment based on method
    let paymentResult

    if (method === 'upi') {
      // Create UPI payment intent
      paymentResult = await processUPIPayment({
        amount,
        currency,
        upiId: details.upiId,
        customerEmail,
        customerPhone,
      })
    } else if (method === 'card') {
      // Create card payment token
      paymentResult = await processCardPayment({
        amount,
        currency,
        cardNumber: details.cardNumber,
        expiry: details.expiry,
        cvv: details.cvv,
        cardName: details.cardName,
      })
    } else if (method === 'netbanking') {
      // Create net banking payment
      paymentResult = await processNetBankingPayment({
        amount,
        currency,
        bank: details.netBankingBank,
        customerEmail,
      })
    }

    // 3. Save booking confirmation to database
    await saveBookingConfirmation({
      bookingId,
      transactionId: paymentResult.transactionId,
      amount,
      method,
      booking,
      customerEmail,
    })

    // 4. Send confirmation email
    await sendConfirmationEmail(customerEmail, {
      bookingId,
      amount,
      currency,
      booking,
    })

    // 5. Return success response
    return NextResponse.json({
      success: true,
      bookingId,
      transactionId: paymentResult.transactionId,
      message: 'Payment processed successfully',
    })
  } catch (error) {
    console.error('Payment error:', error)
    return NextResponse.json(
      { success: false, message: 'Payment processing failed' },
      { status: 500 }
    )
  }
}

// Helper functions (implement these)
async function processUPIPayment(params: any) {
  // Integrate with Razorpay, Google Pay, or your UPI provider
  // Return { transactionId, status }
}

async function processCardPayment(params: any) {
  // Never handle raw card data - use tokenization
  // Return { transactionId, status }
}

async function processNetBankingPayment(params: any) {
  // Redirect to bank or use payment gateway
  // Return { transactionId, status }
}

async function saveBookingConfirmation(params: any) {
  // Save to your database
}

async function sendConfirmationEmail(email: string, data: any) {
  // Send confirmation email via SendGrid, AWS SES, etc.
}
`

// ============================================================================
// QUICK START CHECKLIST
// ============================================================================

const QUICKSTART_CHECKLIST = `
INTEGRATION CHECKLIST:

1. Component Setup
   ☐ Import PremiumPaymentModal from @/components/booking/PremiumPaymentModal
   ☐ Import usePaymentModal from @/hooks/use-payment-modal
   ☐ Ensure Shadcn/ui components are installed (Dialog, Button, Input, etc.)

2. State Management
   ☐ Setup bookingDetails state with proper structure
   ☐ Setup selectedItem state with price and currency
   ☐ Add showPaymentModal boolean state

3. Payment Handler
   ☐ Implement handlePaymentSubmit function
   ☐ Call your backend /api/payment/process endpoint
   ☐ Return true/false for success/failure

4. Backend API
   ☐ Create /api/payment/process endpoint
   ☐ Validate payment amounts
   ☐ Integrate with payment gateway (Razorpay, Stripe, etc.)
   ☐ Save booking confirmations
   ☐ Send confirmation emails

5. Testing
   ☐ Test UPI payment flow
   ☐ Test card payment flow
   ☐ Test error scenarios
   ☐ Test on mobile devices
   ☐ Test keyboard navigation
   ☐ Verify price calculations

6. Production
   ☐ Use HTTPS only
   ☐ Set environment variables securely
   ☐ Enable payment gateway webhooks
   ☐ Setup logging and monitoring
   ☐ Load test payment endpoints
   ☐ Test refund/dispute handling
`

// ============================================================================
// ENV VARIABLES NEEDED
// ============================================================================

const ENV_VARIABLES = `
# .env.local

# Payment Gateway
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Optional - for other payment methods
STRIPE_PUBLIC_KEY=your_stripe_key
STRIPE_SECRET_KEY=your_stripe_secret

# Email
SENDGRID_API_KEY=your_sendgrid_key

# API URLs
NEXT_PUBLIC_API_URL=https://yourdomain.com
`

export default BookingPageWithPremiumPayment
