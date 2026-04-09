'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Lock,
  Shield,
  ChevronDown,
  ChevronUp,
  Smartphone,
  QrCode,
  Banknote,
  Wallet,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Building,
  Calendar,
  Users,
  MapPin,
  CreditCardIcon,
  Copy,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Types
type PaymentMethod = "upi" | "card" | "netbanking" | "wallet" | "cash"
type PaymentState = "idle" | "processing" | "success" | "error"
type UpiApp = "google-pay" | "phonepe" | "paytm" | "bhim"

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingDetails: {
    checkIn: string
    checkOut: string
    guests: number
    rooms: number
    travelerName: string
    email: string
    phone: string
  }
  selectedItem: {
    name?: string
    type?: string
    price: number
    currency: string
    rating?: number
    address?: string
    departure?: string
    arrival?: string
    duration?: string
  }
  onPaymentSubmit?: (details: any) => Promise<boolean>
  onClose?: () => void
}

interface PriceBreakdown {
  baseFare: number
  taxes: number
  serviceFee: number
  discount?: number
  total: number
}

// Validation utilities
const validateUPIId = (upiId: string): boolean => {
  const upiPattern = /^[a-zA-Z0-9.-]{3,}@[a-zA-Z]{2,}$/
  return upiPattern.test(upiId)
}

const validateCardNumber = (cardNumber: string): boolean => {
  const cleaned = cardNumber.replace(/\s/g, '')
  const pattern = /^[0-9]{13,19}$/
  return pattern.test(cleaned)
}

const validateExpiry = (expiry: string): boolean => {
  const pattern = /^(0[1-9]|1[0-2])\/\d{2}$/
  return pattern.test(expiry)
}

const validateCVV = (cvv: string): boolean => {
  const pattern = /^[0-9]{3,4}$/
  return pattern.test(cvv)
}

const calculatePriceBreakdown = (basePrice: number): PriceBreakdown => {
  const baseFare = basePrice
  const taxes = Math.round(baseFare * 0.05 * 100) / 100
  const serviceFee = Math.round(baseFare * 0.03 * 100) / 100
  const total = baseFare + taxes + serviceFee

  return { baseFare, taxes, serviceFee, total }
}

const formatPrice = (amount: number, currency: string = "INR") => {
  if (currency === "INR") {
    return `₹${amount.toLocaleString('en-IN')}`
  }
  return `$${amount.toLocaleString('en-US')}`
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const calculateNights = (checkIn: string, checkOut: string) => {
  if (!checkIn || !checkOut) return 0
  const check = new Date(checkIn)
  const checkout = new Date(checkOut)
  return Math.ceil((checkout.getTime() - check.getTime()) / (1000 * 60 * 60 * 24))
}

// Trust signals component
const TrustSignals: React.FC = () => (
  <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4 mb-4">
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600">
          <Lock className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-green-900">🔒 100% Secure Payments</p>
          <p className="text-xs text-green-700 mt-0.5">Powered by Razorpay & Stripe</p>
        </div>
      </div>
      
      <div className="flex gap-2 ml-11">
        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded text-xs">
          <Shield className="h-3 w-3 text-green-600" />
          <span className="text-gray-700">PCI DSS Level 1</span>
        </div>
        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded text-xs">
          <Lock className="h-3 w-3 text-green-600" />
          <span className="text-gray-700">256-bit SSL</span>
        </div>
      </div>
      
      <p className="text-xs text-green-700 ml-11">
        Your payment details are encrypted and never stored on our servers
      </p>
    </div>
  </div>
)

// Booking summary component
const BookingSummary: React.FC<{
  bookingDetails: any
  selectedItem: any
  nights?: number
}> = ({ bookingDetails, selectedItem, nights = 0 }) => {
  return (
    <Card className="mb-4 border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Booking Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {selectedItem.type && (
          <div className="flex justify-between">
            <span className="text-gray-700">Booking Type:</span>
            <span className="font-medium capitalize">{selectedItem.type}</span>
          </div>
        )}
        
        {selectedItem.address && (
          <div className="flex justify-between">
            <span className="text-gray-700">Location:</span>
            <span className="font-medium text-right max-w-[200px]">{selectedItem.address}</span>
          </div>
        )}
        
        {bookingDetails.checkIn && (
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Dates:</span>
            <div className="flex gap-2 items-center text-right">
              <span className="font-medium">{formatDate(bookingDetails.checkIn)}</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-medium">{formatDate(bookingDetails.checkOut)}</span>
            </div>
          </div>
        )}
        
        {nights > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-700">Duration:</span>
            <span className="font-medium">{nights} night{nights > 1 ? 's' : ''}</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-gray-700">Guests:</span>
          <span className="font-medium">{bookingDetails.guests}</span>
        </div>
        
        {bookingDetails.rooms && (
          <div className="flex justify-between">
            <span className="text-gray-700">Rooms:</span>
            <span className="font-medium">{bookingDetails.rooms}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Price breakdown component
const PriceBreakdownComponent: React.FC<{
  breakdown: PriceBreakdown
  currency: string
}> = ({ breakdown, currency }) => {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <Card className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <span className="font-semibold">Price Breakdown</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
      </button>

      {isExpanded && (
        <CardContent className="pt-0 space-y-3 border-t">
          <div className="flex justify-between items-center text-sm pt-4">
            <span className="text-gray-700">Base Fare</span>
            <span className="font-medium">{formatPrice(breakdown.baseFare, currency)}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Taxes (5%)</span>
            <span className="font-medium">{formatPrice(breakdown.taxes, currency)}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Service Fee (3%)</span>
            <span className="font-medium">{formatPrice(breakdown.serviceFee, currency)}</span>
          </div>

          {breakdown.discount && breakdown.discount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-700 font-medium">Discount Applied</span>
              <span className="font-medium text-green-700">
                -{formatPrice(breakdown.discount, currency)}
              </span>
            </div>
          )}
          
          <div className="border-t pt-3 mt-3 flex justify-between items-center">
            <span className="font-bold text-base">Total Amount</span>
            <span className="font-bold text-lg text-blue-600">
              {formatPrice(breakdown.total, currency)}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// Payment methods component
const PaymentMethodsComponent: React.FC<{
  selectedMethod: PaymentMethod
  onMethodChange: (method: PaymentMethod) => void
  onSubmit: () => void
  isLoading: boolean
  errors: Record<string, string>
  paymentDetails: any
  onDetailsChange: (details: any) => void
}> = ({
  selectedMethod,
  onMethodChange,
  onSubmit,
  isLoading,
  errors,
  paymentDetails,
  onDetailsChange,
}) => {
  const [expandedMethod, setExpandedMethod] = useState<PaymentMethod | null>(selectedMethod)
  const [showCVV, setShowCVV] = useState(false)

  const upiApps: { id: UpiApp; name: string; icon: string }[] = [
    { id: 'google-pay', name: 'Google Pay', icon: '🟠' },
    { id: 'phonepe', name: 'PhonePe', icon: '🔵' },
    { id: 'paytm', name: 'Paytm', icon: '🟦' },
    { id: 'bhim', name: 'BHIM', icon: '🟩' },
  ]

  const banks = [
    { name: 'HDFC Bank', code: 'HDFC' },
    { name: 'ICICI Bank', code: 'ICICI' },
    { name: 'Axis Bank', code: 'AXIS' },
    { name: 'SBI', code: 'SBI' },
    { name: 'Punjab National Bank', code: 'PNB' },
  ]

  const renderPaymentMethod = (method: PaymentMethod) => {
    switch (method) {
      case 'upi':
        return (
          <div className="space-y-4 p-4 pt-0">
            <div>
              <p className="text-sm font-medium mb-2">Select UPI App</p>
              <div className="grid grid-cols-2 gap-2">
                {upiApps.map(app => (
                  <Button
                    key={app.id}
                    type="button"
                    variant={paymentDetails.selectedUpiApp === app.id ? 'default' : 'outline'}
                    className="h-auto py-3 flex-col gap-1"
                    onClick={() =>
                      onDetailsChange({
                        ...paymentDetails,
                        selectedUpiApp: app.id,
                      })
                    }
                  >
                    <span className="text-lg">{app.icon}</span>
                    <span className="text-xs">{app.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upiId">UPI ID</Label>
              <Input
                id="upiId"
                placeholder="yourname@upi"
                value={paymentDetails.upiId || ''}
                onChange={e =>
                  onDetailsChange({
                    ...paymentDetails,
                    upiId: e.target.value,
                  })
                }
                className={errors.upiId ? 'border-red-500' : ''}
              />
              {errors.upiId && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.upiId}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Format: 9876543210@ybl or username@paytm
              </p>
            </div>

            <Button
              onClick={onSubmit}
              disabled={isLoading || !paymentDetails.upiId}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4 mr-2" />
                  Pay with {paymentDetails.selectedUpiApp}
                </>
              )}
            </Button>
          </div>
        )

      case 'card':
        return (
          <div className="space-y-4 p-4 pt-0">
            <div className="space-y-3">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={paymentDetails.cardNumber || ''}
                onChange={e => {
                  const value = e.target.value.replace(/\s/g, '')
                  onDetailsChange({
                    ...paymentDetails,
                    cardNumber: value,
                  })
                }}
                className={errors.cardNumber ? 'border-red-500' : ''}
              />
              {errors.cardNumber && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.cardNumber}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="cardName">Card Holder Name</Label>
              <Input
                id="cardName"
                placeholder="John Doe"
                value={paymentDetails.cardName || ''}
                onChange={e =>
                  onDetailsChange({
                    ...paymentDetails,
                    cardName: e.target.value,
                  })
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={paymentDetails.expiry || ''}
                  onChange={e =>
                    onDetailsChange({
                      ...paymentDetails,
                      expiry: e.target.value,
                    })
                  }
                  className={errors.expiry ? 'border-red-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <div className="relative">
                  <Input
                    id="cvv"
                    type={showCVV ? 'text' : 'password'}
                    placeholder="123"
                    value={paymentDetails.cvv || ''}
                    onChange={e =>
                      onDetailsChange({
                        ...paymentDetails,
                        cvv: e.target.value,
                      })
                    }
                    className={errors.cvv ? 'border-red-500' : ''}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCVV(!showCVV)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showCVV ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                <input type="checkbox" className="rounded" />
                Save this card for future bookings
              </label>
            </div>

            <Button
              onClick={onSubmit}
              disabled={isLoading || !paymentDetails.cardNumber}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCardIcon className="h-4 w-4 mr-2" />
                  Pay with Card
                </>
              )}
            </Button>
          </div>
        )

      case 'netbanking':
        return (
          <div className="space-y-4 p-4 pt-0">
            <div className="space-y-2">
              <Label>Select Your Bank</Label>
              <Select
                value={paymentDetails.netBankingBank || ''}
                onValueChange={value =>
                  onDetailsChange({
                    ...paymentDetails,
                    netBankingBank: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose your bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map(bank => (
                    <SelectItem key={bank.code} value={bank.name}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={onSubmit}
              disabled={isLoading || !paymentDetails.netBankingBank}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting to Bank...
                </>
              ) : (
                <>
                  <Building className="h-4 w-4 mr-2" />
                  Proceed to Bank Login
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              You will be redirected to your bank's secured website for authentication.
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-3">
      {(['upi', 'card', 'netbanking'] as PaymentMethod[]).map(method => (
        <Card
          key={method}
          className={cn(
            'cursor-pointer transition-all',
            selectedMethod === method && 'ring-2 ring-blue-500',
            expandedMethod === method && 'ring-2 ring-blue-500'
          )}
        >
          <button
            onClick={() => {
              onMethodChange(method)
              setExpandedMethod(expandedMethod === method ? null : method)
            }}
            className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="payment-method"
                checked={selectedMethod === method}
                onChange={() => onMethodChange(method)}
                className="h-4 w-4"
              />
              <div>
                <p className="font-medium capitalize">
                  {method === 'upi' && 'UPI'}
                  {method === 'card' && 'Credit/Debit Card'}
                  {method === 'netbanking' && 'Net Banking'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {method === 'upi' && 'Fast & secure via UPI'}
                  {method === 'card' && 'Visa, MasterCard, RuPay'}
                  {method === 'netbanking' && 'Direct bank transfer'}
                </p>
              </div>
            </div>
            {expandedMethod === method ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>

          {expandedMethod === method && renderPaymentMethod(method)}
        </Card>
      ))}
    </div>
  )
}

// Main Modal Component
export const PremiumPaymentModal: React.FC<PaymentModalProps> = ({
  open,
  onOpenChange,
  bookingDetails,
  selectedItem,
  onPaymentSubmit,
  onClose,
}) => {
  const [paymentState, setPaymentState] = useState<PaymentState>('idle')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('upi')
  const [paymentDetails, setPaymentDetails] = useState<any>({
    selectedUpiApp: 'google-pay',
    upiId: '',
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
    netBankingBank: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const priceBreakdown = calculatePriceBreakdown(selectedItem.price)
  const nights = calculateNights(bookingDetails.checkIn, bookingDetails.checkOut)

  // Validation
  const validatePaymentDetails = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (selectedMethod === 'upi') {
      if (!paymentDetails.upiId) {
        newErrors.upiId = 'UPI ID is required'
      } else if (!validateUPIId(paymentDetails.upiId)) {
        newErrors.upiId = 'Invalid UPI ID format'
      }
    } else if (selectedMethod === 'card') {
      if (!paymentDetails.cardNumber) {
        newErrors.cardNumber = 'Card number is required'
      } else if (!validateCardNumber(paymentDetails.cardNumber)) {
        newErrors.cardNumber = 'Invalid card number'
      }
      if (!paymentDetails.expiry || !validateExpiry(paymentDetails.expiry)) {
        newErrors.expiry = 'Invalid expiry date (MM/YY)'
      }
      if (!paymentDetails.cvv || !validateCVV(paymentDetails.cvv)) {
        newErrors.cvv = 'Invalid CVV'
      }
    } else if (selectedMethod === 'netbanking') {
      if (!paymentDetails.netBankingBank) {
        newErrors.netBankingBank = 'Please select a bank'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePaymentSubmit = async () => {
    setErrors({})
    setErrorMessage('')

    if (!validatePaymentDetails()) {
      setErrorMessage('Please fix the errors below and try again')
      return
    }

    setPaymentState('processing')

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Call the onPaymentSubmit callback if provided
      if (onPaymentSubmit) {
        const success = await onPaymentSubmit({
          method: selectedMethod,
          details: paymentDetails,
          amount: priceBreakdown.total,
          currency: selectedItem.currency,
        })

        if (success) {
          setPaymentState('success')
          setSuccessMessage('Payment successful! Your booking is confirmed.')
          setTimeout(() => {
            onOpenChange(false)
            onClose?.()
          }, 2000)
        } else {
          setPaymentState('error')
          setErrorMessage('Payment failed. Please try again.')
        }
      } else {
        // Default success flow
        setPaymentState('success')
        setSuccessMessage('Payment successful! Your booking is confirmed.')
        setTimeout(() => {
          onOpenChange(false)
          onClose?.()
        }, 2000)
      }
    } catch (error) {
      setPaymentState('error')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'An error occurred during payment. Please try again.'
      )
    }
  }

  const handleClose = () => {
    if (paymentState !== 'processing') {
      setPaymentState('idle')
      setErrors({})
      setErrorMessage('')
      setSuccessMessage('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {paymentState === 'success' ? '✨ Payment Successful' : 'Secure Payment'}
          </DialogTitle>
          <DialogDescription>
            {paymentState === 'success'
              ? 'Your booking is confirmed'
              : 'Review your booking and complete the secure payment'}
          </DialogDescription>
        </DialogHeader>

        {paymentState === 'success' ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 animate-ping opacity-75">
                <CheckCircle className="h-24 w-24 text-green-400" />
              </div>
              <CheckCircle className="h-24 w-24 text-green-500 relative" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-600">{successMessage}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                A confirmation email has been sent to {bookingDetails.email}
              </p>
            </div>
          </div>
        ) : paymentState === 'error' ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <Button
              onClick={() => setPaymentState('idle')}
              className="w-full"
              variant="destructive"
            >
              Try Again
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Trust Signals */}
            <TrustSignals />

            {/* Booking Summary */}
            <BookingSummary
              bookingDetails={bookingDetails}
              selectedItem={selectedItem}
              nights={nights}
            />

            {/* Price Breakdown */}
            <PriceBreakdownComponent
              breakdown={priceBreakdown}
              currency={selectedItem.currency}
            />

            {/* Refund/Cancellation Info */}
            <Alert className="border-blue-200 bg-blue-50">
              <Clock className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                <strong>Free cancellation</strong> until 24 hours before check-in
              </AlertDescription>
            </Alert>

            {/* Error Messages */}
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Payment Methods */}
            <div>
              <h3 className="font-semibold mb-3 text-base">Choose Payment Method</h3>
              <PaymentMethodsComponent
                selectedMethod={selectedMethod}
                onMethodChange={method => {
                  setSelectedMethod(method)
                  setErrors({})
                }}
                onSubmit={handlePaymentSubmit}
                isLoading={paymentState === 'processing'}
                errors={errors}
                paymentDetails={paymentDetails}
                onDetailsChange={setPaymentDetails}
              />
            </div>

            {/* Sticky CTA Footer */}
            <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent pt-4">
              <Button
                onClick={handlePaymentSubmit}
                disabled={paymentState === 'processing'}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg"
              >
                {paymentState === 'processing' ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5 mr-2" />
                    Pay {formatPrice(priceBreakdown.total, selectedItem.currency)} Securely
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Your payment is protected by 256-bit SSL encryption
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default PremiumPaymentModal
