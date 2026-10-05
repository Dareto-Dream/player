import { useEffect, useRef, useState } from "react";

let loader: Promise<void> | undefined;
function loadStripe() {
  return (loader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.onload = () => resolve();
    script.onerror = () => {
      loader = undefined;
      reject(new Error("Could not load secure checkout."));
    };
    document.head.appendChild(script);
  }));
}

export default function Checkout({
  clientSecret,
  publishableKey,
  onDone,
}: {
  clientSecret: string;
  publishableKey?: string;
  onDone: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const payment = useRef<{ stripe: any; card: any } | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let disposed = false;
    if (!publishableKey) {
      setError(
        "This host has not configured checkout. No payment has been taken.",
      );
      return;
    }
    void loadStripe()
      .then(() => {
        if (disposed) return;
        const stripe = (window as any).Stripe(publishableKey);
        const card = stripe
          .elements()
          .create("card", {
            style: { base: { color: "#edeee8", fontSize: "16px" } },
          });
        card.mount(mount.current);
        payment.current = { stripe, card };
        setReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      disposed = true;
      payment.current?.card.destroy();
      payment.current = null;
    };
  }, [publishableKey, clientSecret]);
  const pay = async () => {
    if (!payment.current || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await payment.current.stripe.confirmCardPayment(
        clientSecret,
        { payment_method: { card: payment.current.card } },
      );
      if (result.error) throw new Error(result.error.message);
      if (result.paymentIntent?.status === "succeeded") {
        onDone();
      } else
        setError(
          "Payment is processing. Your request will update when Stripe confirms it.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="checkout">
      <h3>Secure checkout</h3>
      <p className="field-help">
        Card details go directly to Stripe. Your queue position updates after
        payment confirmation.
      </p>
      <div className="stripe-card" ref={mount} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button button-primary"
        disabled={!ready || busy}
        onClick={pay}
      >
        {busy ? "Confirming…" : "Confirm payment"}
      </button>
    </section>
  );
}
