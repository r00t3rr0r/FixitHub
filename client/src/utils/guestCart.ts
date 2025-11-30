// Guest cart management using localStorage for non-registered users

export interface GuestCartItem {
  _id: string
  product: {
    _id: string
    name: string
    price: number
    images: string[]
    category: string
  }
  quantity: number
}

export interface GuestRepairOrder {
  _id: string
  deviceType: string
  deviceBrand: string
  deviceModel: string
  services: any[]
  addOns: any[]
  totalCost: number
  customerNotes?: string
  photos?: string[]
  unlockPattern?: string[]
  unlockCode?: string
  noLock?: boolean
}

export interface GuestCart {
  items: GuestCartItem[]
  repairOrders: GuestRepairOrder[]
  totalCost: number
  itemCount: number
}

const GUEST_CART_KEY = 'guestCart'

// Initialize empty guest cart
const getEmptyCart = (): GuestCart => ({
  items: [],
  repairOrders: [],
  totalCost: 0,
  itemCount: 0
})

// Get guest cart from localStorage
export const getGuestCart = (): GuestCart => {
  try {
    const cartData = localStorage.getItem(GUEST_CART_KEY)
    if (!cartData) {
      return getEmptyCart()
    }
    const cart = JSON.parse(cartData)
    return cart
  } catch (error) {
    console.error('Error getting guest cart:', error)
    return getEmptyCart()
  }
}

// Save guest cart to localStorage
const saveGuestCart = (cart: GuestCart): void => {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart))
    // Dispatch custom event for cart updates
    window.dispatchEvent(new Event('guestCartUpdate'))
  } catch (error) {
    console.error('Error saving guest cart:', error)
  }
}

// Calculate cart totals
const calculateCartTotals = (cart: GuestCart): void => {
  cart.totalCost = 0
  cart.itemCount = 0

  // Calculate product items total
  cart.items.forEach(item => {
    cart.totalCost += item.product.price * item.quantity
    cart.itemCount += item.quantity
  })

  // Calculate repair orders total
  cart.repairOrders.forEach(order => {
    cart.totalCost += order.totalCost
    cart.itemCount += 1
  })
}

// Add product to guest cart
export const addToGuestCart = (product: any, quantity: number = 1): GuestCart => {
  const cart = getGuestCart()

  // Check if product already exists in cart
  const existingItemIndex = cart.items.findIndex(item => item.product._id === product._id)

  if (existingItemIndex > -1) {
    // Update quantity
    cart.items[existingItemIndex].quantity += quantity
  } else {
    // Add new item
    cart.items.push({
      _id: `item_${Date.now()}`,
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        images: product.images || [],
        category: product.category
      },
      quantity
    })
  }

  calculateCartTotals(cart)
  saveGuestCart(cart)
  return cart
}

// Update item quantity in guest cart
export const updateGuestCartItem = (itemId: string, quantity: number): GuestCart => {
  const cart = getGuestCart()
  const itemIndex = cart.items.findIndex(item => item._id === itemId)

  if (itemIndex > -1) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      cart.items.splice(itemIndex, 1)
    } else {
      cart.items[itemIndex].quantity = quantity
    }
  }

  calculateCartTotals(cart)
  saveGuestCart(cart)
  return cart
}

// Remove item from guest cart
export const removeFromGuestCart = (itemId: string): GuestCart => {
  const cart = getGuestCart()
  cart.items = cart.items.filter(item => item._id !== itemId)

  calculateCartTotals(cart)
  saveGuestCart(cart)
  return cart
}

// Add repair order to guest cart
export const addRepairOrderToGuestCart = (repairOrderData: any): GuestCart => {
  const cart = getGuestCart()

  const repairOrder: GuestRepairOrder = {
    _id: `repair_${Date.now()}`,
    deviceType: repairOrderData.deviceType,
    deviceBrand: repairOrderData.deviceBrand,
    deviceModel: repairOrderData.deviceModel,
    services: repairOrderData.services || [],
    addOns: repairOrderData.addOns || [],
    totalCost: repairOrderData.totalCost,
    customerNotes: repairOrderData.customerNotes,
    photos: repairOrderData.photos,
    unlockPattern: repairOrderData.unlockPattern,
    unlockCode: repairOrderData.unlockCode,
    noLock: repairOrderData.noLock
  }

  cart.repairOrders.push(repairOrder)
  calculateCartTotals(cart)
  saveGuestCart(cart)
  return cart
}

// Remove repair order from guest cart
export const removeRepairOrderFromGuestCart = (repairOrderId: string): GuestCart => {
  const cart = getGuestCart()
  cart.repairOrders = cart.repairOrders.filter(order => order._id !== repairOrderId)

  calculateCartTotals(cart)
  saveGuestCart(cart)
  return cart
}

// Clear guest cart
export const clearGuestCart = (): GuestCart => {
  const emptyCart = getEmptyCart()
  saveGuestCart(emptyCart)
  return emptyCart
}

// Get cart item count
export const getGuestCartItemCount = (): number => {
  const cart = getGuestCart()
  return cart.itemCount
}

// Merge guest cart with user cart (called after login)
export const mergeGuestCartWithUserCart = async (userCartService: any): Promise<void> => {
  const guestCart = getGuestCart()

  // If guest cart is empty, nothing to merge
  if (guestCart.items.length === 0 && guestCart.repairOrders.length === 0) {
    return
  }

  try {
    // Add all guest cart items to user cart
    for (const item of guestCart.items) {
      await userCartService.addToCart(item.product._id, item.quantity)
    }

    // Add all guest repair orders to user cart
    for (const order of guestCart.repairOrders) {
      await userCartService.addRepairOrderToCart(order)
    }

    // Clear guest cart after successful merge
    clearGuestCart()
    console.log('Guest cart successfully merged with user cart')
  } catch (error) {
    console.error('Error merging guest cart with user cart:', error)
    throw error
  }
}
