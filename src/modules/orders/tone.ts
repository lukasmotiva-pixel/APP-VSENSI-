import type { OrderStatus } from "@prisma/client";
import type { BadgeTone } from "@/components/ui/badge";

export const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  RECEIVED: "neutral", AWAITING_PAYMENT: "warning", PAYMENT_CONFIRMED: "navy", IN_PREPARATION: "navy",
  READY_TO_SHIP: "navy", SHIPPED: "navy", DELIVERED: "positive", CANCELED: "neutral",
};
