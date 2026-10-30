import { TriangleAlertIcon } from "lucide-react"
import { Component, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// ErrorBoundary keeps a failure in one page (a render error, or a chunk
// that failed to load) from unmounting the whole app.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return <Failed error={this.state.error} onRetry={() => this.setState({ error: undefined })} />
    }
    return this.props.children
  }
}

function Failed({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{t("common.failed")}</EmptyTitle>
        <EmptyDescription className="break-all">{error.message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
