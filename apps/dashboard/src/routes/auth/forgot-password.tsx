import { recoverPasswordSchema } from "@repo/schemas/auth"
import { Card, CardContent } from "@repo/ui/components/card"
import { FieldGroup } from "@repo/ui/components/field"
import { Check, PasswordLock } from "@repo/ui/icons"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import z from "zod"
import { setFormErrors, useAppForm } from "@/components/form"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authAPI } from "@/lib/api"

const recoverPasswordSearchSchema = z.object({
  sent: z.boolean().optional().default(false),
})

export const Route = createFileRoute("/auth/forgot-password")({
  validateSearch: recoverPasswordSearchSchema,
  component: RouteComponent,
})

const RETRY_KEY = "recovery-retry-after"

function RouteComponent() {
  const { sent } = Route.useSearch()
  const navigate = Route.useNavigate()
  const setSent = (value: boolean) => {
    navigate({
      search: (prev) => ({ ...prev, sent: value }),
      replace: true, // don't pollute browser history for this
    })
  }

  const { retryAfter, setRetryAfter, isThrottled } = useRetryAfter()

  const handleError = useErrorHandler()
  const form = useAppForm({
    defaultValues: {
      email: "",
    },
    validators: {
      onSubmit: recoverPasswordSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const data = await authAPI.recoverPassword(value)
        setRetryAfter(new Date(data.retry_after))
        setSent(true)
      } catch (error) {
        handleError(error, {
          VALIDATION: (e) => setFormErrors(formApi, e.details),
          AUTH_RECOVERY_THROTTLED: (e) => {
            setRetryAfter(new Date(e.details.retry_after))
          },
          RESOURCE_NOT_FOUND: () =>
            setFormErrors(formApi, {
              email: "Email yang Anda masukkan tidak terdaftar",
            }),
        })
      }
    },
  })

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center p-6 md:p-10 gap-8">
      <div className="w-full md:w-[60%] xl:w-[30%]">
        <div className="text-center">
          {sent ? (
            <>
              <Check className="mx-auto size-12 text-green-500" />
              <p className="text-xl font-bold">Lupa Kata Sandi</p>
              <p>
                Kami telah mengirimkan tautan untuk mengatur ulang kata sandi ke
                alamat email Anda. Silakan periksa kotak masuk dan folder spam.
              </p>
              <p className="mt-4 text-sm">
                Tidak menerima email?{" "}
                <Link
                  to="/auth/forgot-password"
                  search={{
                    sent: false,
                  }}
                  className="hover:underline inline text-blue-600 cursor-pointer hover:text-purple-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Coba lagi
                </Link>
              </p>
            </>
          ) : (
            <>
              <PasswordLock className="mx-auto size-12" />
              <p className="text-xl font-bold">Lupa Kata Sandi</p>
              <p>
                Masukkan alamat email yang terdaftar. Kami akan mengirimkan
                tautan untuk mengatur ulang kata sandi Anda.
              </p>
            </>
          )}
        </div>
        {!sent && (
          <Card className="[--card-spacing:--spacing(6)]! mt-6">
            <CardContent className="flex-1 flex flex-col">
              <form.AppForm>
                <form.Root className="flex-1 flex flex-col gap-8">
                  <FieldGroup className="flex-1">
                    <form.AppField
                      name="email"
                      children={(field) => (
                        <field.Container>
                          <field.Label text="Email" required />
                          <field.TextField
                            placeholder="Masukan alamat email Anda"
                            autoComplete="on"
                          />
                          <field.Errors />
                        </field.Container>
                      )}
                    />
                  </FieldGroup>
                  <form.SubmitButton className="w-full" disabled={isThrottled}>
                    {isThrottled && retryAfter ? (
                      <>
                        Coba lagi dalam <Countdown until={retryAfter} />
                      </>
                    ) : (
                      "Kirim"
                    )}
                  </form.SubmitButton>
                </form.Root>
              </form.AppForm>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function Countdown({ until }: { until: Date }) {
  const getRemainingSeconds = () =>
    Math.max(0, Math.ceil((until.getTime() - Date.now()) / 1000))
  const [seconds, setSeconds] = useState(getRemainingSeconds)

  // biome-ignore lint/correctness/useExhaustiveDependencies: getRemainingSeconds is derived purely from `until`
  useEffect(() => {
    setSeconds(getRemainingSeconds())
    const timer = setInterval(() => {
      setSeconds(getRemainingSeconds())
    }, 1000)
    return () => clearInterval(timer)
  }, [until])

  return <span>{seconds} detik</span>
}

function useRetryAfter() {
  const [retryAfter, setRetryAfter] = useState<Date | null>(() => {
    const raw = localStorage.getItem(RETRY_KEY)
    if (!raw) return null
    const date = new Date(raw)
    const isValidDate = date instanceof Date && !Number.isNaN(date.getTime())
    if (!isValidDate || date.getTime() <= Date.now()) {
      localStorage.removeItem(RETRY_KEY)
      return null
    }
    return date
  })

  const isThrottled = retryAfter !== null && retryAfter.getTime() > Date.now()

  // Persist retryAfter, and auto-clear it (and the button lock) once it elapses
  useEffect(() => {
    if (!retryAfter) {
      localStorage.removeItem(RETRY_KEY)
      return
    }
    localStorage.setItem(RETRY_KEY, retryAfter.toISOString())
    const ms = retryAfter.getTime() - Date.now()
    if (ms <= 0) {
      setRetryAfter(null)
      return
    }
    const timer = setTimeout(() => {
      setRetryAfter(null)
    }, ms)
    return () => clearTimeout(timer)
  }, [retryAfter])

  return { retryAfter, setRetryAfter, isThrottled }
}
