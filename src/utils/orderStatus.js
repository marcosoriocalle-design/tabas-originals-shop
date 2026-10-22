export const orderStatuses = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
export const statusTransitions = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};
