async function chooseOption(input, value) {
  if (await input.getAttribute('aria-expanded') !== 'true') await input.click()
  const popup = await input.getAttribute('aria-controls')
  await input.page().locator(`[id=${JSON.stringify(popup)}] [role="option"][data-option-value=${JSON.stringify(value)}]`).click()
}

module.exports = { chooseOption }
