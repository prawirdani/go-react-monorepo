export async function delay(ms = 350) {
	await new Promise((res) => setTimeout(res, ms));
}
