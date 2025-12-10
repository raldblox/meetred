declare module 'lucide-react' {
  import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react'

  export interface LucideProps extends SVGProps<SVGSVGElement> {
    color?: string
    size?: string | number
    strokeWidth?: string | number
    absoluteStrokeWidth?: boolean
  }

  type Icon = ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>

  export const Copy: Icon
  export const ExternalLink: Icon
  export const Loader2: Icon
  export const RefreshCw: Icon
  export const Send: Icon
  export const Users: Icon
}
