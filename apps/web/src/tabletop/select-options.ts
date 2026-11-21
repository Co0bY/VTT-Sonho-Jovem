export function selectOptions<Choice extends string>(labels: Record<Choice, string>) {
  return (Object.keys(labels) as Choice[]).map(value => ({ value, label: labels[value] }))
}
