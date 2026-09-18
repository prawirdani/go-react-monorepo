import { useTranslations } from "@repo/i18n"
import { recoverPasswordSchema } from "@repo/schemas/auth"
import { FieldGroup } from "@repo/ui/components/field"
import { Check } from "@repo/ui/icons"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import z from "zod"
import { setFormErrors, useAppForm } from "@/components/form"
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell"
import { useErrorHandler } from "@/hooks/use-error-handler"
import { authAPI } from "@/lib/data-access/api"

const recoverPasswordSearchSchema = z.object({
  sent: z.boolean().optional().default(false),
})

export const Route = createFileRoute("/auth/forgot-password")({
  validateSearch: recoverPasswordSearchSchema,
  component: RouteComponent,
})

const RETRY_KEY = "recovery-retry-after"

const linkClass =
  "rounded-sm text-primary outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"

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
  const t = useTranslations("app")
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
              email: t("auth.forgot.emailNotFound"),
            }),
        })
      }
    },
  })

  return (
    <AuthShell>
      <AuthPanel
        title={t("auth.forgot.title")}
        description={
          sent ? t("auth.forgot.sentDescription") : t("auth.forgot.description")
        }
      >
        {sent ? (
          <SentContent />
        ) : (
          <form.AppForm>
            <form.Root className="flex flex-col gap-6">
              <FieldGroup className="gap-5">
                <form.AppField
                  name="email"
                  children={(field) => (
                    <field.Container>
                      <field.Label text={t("auth.fields.email")} required />
                      <field.TextField
                        placeholder={t("auth.fields.emailPlaceholder")}
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
                    {t("auth.forgot.retryIn")} <Countdown until={retryAfter} />
                  </>
                ) : (
                  t("auth.forgot.submit")
                )}
              </form.SubmitButton>
            </form.Root>
          </form.AppForm>
        )}
      </AuthPanel>
    </AuthShell>
  )
}

function SentContent() {
  const t = useTranslations("app")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Check className="mt-0.5 size-5 shrink-0 text-success" />
        <p className="text-sm text-muted-foreground">
          {t("auth.forgot.sentMessage")}
        </p>
      </div>
      <p className="border-t border-border pt-3 text-sm text-muted-foreground">
        {t("auth.forgot.noEmail")}{" "}
        <Link
          to="/auth/forgot-password"
          search={{
            sent: false,
          }}
          className={linkClass}
        >
          {t("auth.forgot.tryAgain")}
        </Link>
      </p>
    </div>
  )
}

function Countdown({ until }: { until: Date }) {
  const t = useTranslations("app")
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

  return (
    <span>
      {seconds} {t("auth.forgot.secondsUnit")}
    </span>
  )
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
