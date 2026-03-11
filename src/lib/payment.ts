import Decimal from "decimal.js-light";
import { PROTOCOL_FEE_BPS, PROTOCOL_TREASURY } from "./constants";

interface PaymentRequestData {
  recipient: string;
  amount: number;
  reference: string;
  fee_address?: string;
  fee_amount?: number;
}

/**
 * Validate that a payment request has the correct recipient and protocol fee params.
 * Returns an error message if invalid, null if OK.
 *
 * @param requestJson  — the raw payment request JSON from the provider
 * @param expectedRecipient — the provider's Solana address from their capability card
 *
 * Uses decimal.js-light for precise fee calculation (basis points math).
 */
export function validatePaymentFee(
  requestJson: string,
  expectedRecipient?: string,
): string | null {
  let data: PaymentRequestData;
  try {
    data = JSON.parse(requestJson);
  } catch (e) {
    return `Invalid payment request JSON: ${e}`;
  }

  // Validate recipient matches the provider's known Solana address
  if (expectedRecipient && data.recipient !== expectedRecipient) {
    return (
      `Recipient mismatch: expected ${expectedRecipient}, got ${data.recipient}. ` +
      `Provider may be attempting to redirect payment.`
    );
  }

  // Calculate expected fee: ceil(amount * PROTOCOL_FEE_BPS / 10_000)
  // decimal.js-light uses toDecimalPlaces with ROUND_UP for ceil behavior
  const amount = new Decimal(data.amount);
  const expectedFee = amount
    .mul(PROTOCOL_FEE_BPS)
    .div(10_000)
    .toDecimalPlaces(0, Decimal.ROUND_UP)
    .toNumber();

  const { fee_address, fee_amount } = data;

  if (fee_address && fee_amount && fee_amount > 0) {
    if (fee_address !== PROTOCOL_TREASURY) {
      return (
        `Fee address mismatch: expected ${PROTOCOL_TREASURY}, got ${fee_address}. ` +
        `Provider may be attempting to redirect fees.`
      );
    }
    if (fee_amount !== expectedFee) {
      return (
        `Fee amount mismatch: expected ${expectedFee} lamports ` +
        `(${PROTOCOL_FEE_BPS}bps of ${data.amount}), got ${fee_amount}. ` +
        `Provider may be tampering with fee.`
      );
    }
    return null;
  }

  if (!fee_address && !fee_amount) {
    return (
      `Payment request missing protocol fee (${PROTOCOL_FEE_BPS}bps). ` +
      `Expected fee: ${expectedFee} lamports to ${PROTOCOL_TREASURY}.`
    );
  }

  return (
    `Invalid fee params in payment request. ` +
    `Expected fee: ${expectedFee} lamports to ${PROTOCOL_TREASURY}.`
  );
}
