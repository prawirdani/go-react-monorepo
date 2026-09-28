export const getCookie = (name: string): string | undefined => {
  const nameEQ = `${encodeURIComponent(name)}=`
  const cookies = document.cookie.split(";")

  for (let cookie of cookies) {
    cookie = cookie.trim()
    if (cookie.startsWith(nameEQ)) {
      return decodeURIComponent(cookie.substring(nameEQ.length))
    }
  }

  return undefined
}
