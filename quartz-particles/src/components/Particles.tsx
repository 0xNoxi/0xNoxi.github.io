import type { QuartzComponent, QuartzComponentConstructor } from "@quartz-community/types"
// @ts-ignore
import script from "./particles.inline.ts"

const css = `
#particles-bg {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
}
.page {
  position: relative;
  z-index: 1;
}
`

export default (() => {
  const Particles: QuartzComponent = () => null
  Particles.css = css
  Particles.afterDOMLoaded = script
  return Particles
}) satisfies QuartzComponentConstructor