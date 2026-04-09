import { useState, useCallback } from 'react'

type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'cash'
type PaymentState = 'idle' | 'processing' | 'success' | 'error'

interface PaymentError {
  field: string
  message: string
}

interface UsePaymentModalReturn {
  paymentState: PaymentState
  selectedMethod: PaymentMethod
  paymentDetails: Record<string, any>
  errors: Record<string, string>
  successMessage: string
  errorMessage: string
  
  setPaymentState: (state: PaymentState) => void
  setSelectedMethod: (method: PaymentMethod) => void
  setPaymentDetails: (details: Record<string, any>) => void
  updatePaymentDetail: (key: string, value: any) => void
  setErrors: (errors: Record<string, string>) => void
  addError: (field: string, message: string) => void
  clearError: (field: string) => void
  clearErrors: () => void
  setSuccessMessage: (message: string) => void
  setErrorMessage: (message: string) => void
  reset: () => void
  
  // Validation methods
  validateUPI: (upiId: string) => boolean
  validateCard: (cardNumber: string, expiry: string, cvv: string) => boolean
  validateNetBanking: (bank: string) => boolean
}

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

export const usePaymentModal = (): UsePaymentModalReturn => {
  const [paymentState, setPaymentState] = useState<PaymentState>('idle')
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('upi')
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any>>({
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

  const updatePaymentDetail = useCallback((key: string, value: any) => {
    setPaymentDetails(prev => ({ ...prev, [key]: value }))
  }, [])

  const addError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }))
  }, [])

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }, [])

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  const reset = useCallback(() => {
    setPaymentState('idle')
    setSelectedMethod('upi')
    setPaymentDetails({
      selectedUpiApp: 'google-pay',
      upiId: '',
      cardNumber: '',
      cardName: '',
      expiry: '',
      cvv: '',
      netBankingBank: '',
    })
    setErrors({})
    setSuccessMessage('')
    setErrorMessage('')
  }, [])

  const validateUPI = useCallback((upiId: string): boolean => {
    return validateUPIId(upiId)
  }, [])

  const validateCard = useCallback(
    (cardNumber: string, expiry: string, cvv: string): boolean => {
      return (
        validateCardNumber(cardNumber) &&
        validateExpiry(expiry) &&
        validateCVV(cvv)
      )
    },
    []
  )

  const validateNetBanking = useCallback((bank: string): boolean => {
    return bank.length > 0
  }, [])

  return {
    paymentState,
    selectedMethod,
    paymentDetails,
    errors,
    successMessage,
    errorMessage,

    setPaymentState,
    setSelectedMethod,
    setPaymentDetails,
    updatePaymentDetail,
    setErrors,
    addError,
    clearError,
    clearErrors,
    setSuccessMessage,
    setErrorMessage,
    reset,

    validateUPI,
    validateCard,
    validateNetBanking,
  }
}

export default usePaymentModal
