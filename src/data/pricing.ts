export const premiumPlan = {
  status: "early-access",
  currency: "USD",
  amount: "4.99",
  interval: "month",
  displayPrice: "USD 4.99",
  checkoutLive: true,
  checkoutFunctionUrl:
    "https://msufgvqofnihylcnxyac.supabase.co/functions/v1/create-stripe-checkout",
  paymentMethods: {
    card: { supportedPlans: ["monthly", "quarterly", "annual"] },
    alipay: { supportedPlans: ["quarterly", "annual"] },
  },
} as const;
