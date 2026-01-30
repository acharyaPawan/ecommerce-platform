export class CartError extends Error {
  constructor(message: string, readonly code: string, readonly details?: unknown) {
    super(message);
    this.name = "CartError";
  }
}

export class CartNotFoundError extends CartError {
  constructor(message = "Cart not found") {
    super(message, "CART_NOT_FOUND");
    this.name = "CartNotFoundError";
  }
}

export class CartItemNotFoundError extends CartError {
  constructor(message = "Cart item not found") {
    super(message, "CART_ITEM_NOT_FOUND");
    this.name = "CartItemNotFoundError";
  }
}

export class CartValidationError extends CartError {
  constructor(message: string, details?: unknown) {
    super(message, "CART_VALIDATION_FAILED", details);
    this.name = "CartValidationError";
  }
}

export class CartConcurrencyError extends CartError {
  constructor(message = "Cart update conflicted, please retry") {
    super(message, "CART_CONFLICT");
    this.name = "CartConcurrencyError";
  }
}

export class CartCheckoutError extends CartError {
  constructor(message = "Unable to checkout cart", details?: unknown) {
    super(message, "CART_CHECKOUT_FAILED", details);
    this.name = "CartCheckoutError";
  }
}

export class CartDependencyError extends CartError {
  constructor(message = "Downstream dependency failed", details?: unknown) {
    super(message, "CART_DEPENDENCY_FAILED", details);
    this.name = "CartDependencyError";
  }
}
