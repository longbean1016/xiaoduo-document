export function centerTocItem(
  container: HTMLElement,
  item: HTMLElement,
) {
  const containerRect = container.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  container.scrollTop +=
    itemRect.top +
    itemRect.height / 2 -
    (containerRect.top + container.clientHeight / 2)
}
