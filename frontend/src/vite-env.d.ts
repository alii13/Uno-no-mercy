/// <reference types="vite/client" />

// Declare raw SVG imports
declare module '*.svg?raw' {
  const content: string
  export default content
}

// Declare normal SVG imports (as URLs)
declare module '*.svg' {
  const content: string
  export default content
}

// Declare image imports
declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

