export const normalizeScheduleTime = (input: string): string | null => {
  const value = input.trim();
  const colonMatch = value.match(/^(\d{1,2}):(\d{2})$/);
  const compactMatch = value.match(/^\d{3,4}$/);
  const hour = colonMatch
    ? Number(colonMatch[1])
    : compactMatch
      ? Number(value.slice(0, -2))
      : Number.NaN;
  const minute = colonMatch
    ? Number(colonMatch[2])
    : compactMatch
      ? Number(value.slice(-2))
      : Number.NaN;
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export const isScheduleTime = (input: string) => normalizeScheduleTime(input) === input;
