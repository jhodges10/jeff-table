export function defined<T>(value: T | null | undefined, message = "Expected a defined value"): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}
