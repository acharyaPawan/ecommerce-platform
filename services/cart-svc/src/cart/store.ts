import type { Cart } from "./types.js";

export type CreateCartInput = {
  cartId?: string;
  userId?: string | null;
  currency: string;
};

export interface CartStore {
  createCart(input: CreateCartInput): Promise<Cart>;
  getCart(cartId: string): Promise<Cart | null>;
  deleteCart(cartId: string): Promise<void>;
  getCartIdByUser(userId: string): Promise<string | null>;
  setUserCart(userId: string, cartId: string): Promise<void>;
  clearUserCart(userId: string): Promise<void>;
  updateCart(
    cartId: string,
    mutate: (current: Cart | null) => Promise<Cart | null> | Cart | null
  ): Promise<Cart | null>;
}
