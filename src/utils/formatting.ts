export function formatNumber(value: number | null) {
  if (value !== null && !isNaN(value)) {
    let formattedNum = new Intl.NumberFormat('en', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
    return formattedNum
  } else {
    return '0.00'
  }
}

export function formatCurrencies(value: number | null) {
  if (value !== null && !isNaN(value)) {
    let formattedNum = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
    return formattedNum
  } else {
    return '$0.00'
  }
}

export function formatDate(date: string | Date | null) {
  if (date) {
    const formattedDate = new Date(date).toISOString().split('T')[0]
    return formattedDate // 'yyyy-mm-dd'
  }
  return ''
}
