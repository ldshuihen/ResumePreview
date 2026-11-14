import { jsPDF } from 'jspdf'
import { toJpeg, toPng } from 'html-to-image'

/**
 * Convert an image URL to Base64 data URL so html-to-image never fails on CORS or proxy paths
 */
async function imageUrlToDataUrl(url) {
  if (!url || url.startsWith('data:')) return url
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'same-origin' })
    if (!response.ok) return url
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result || url)
      reader.onerror = () => resolve(url)
      reader.readAsDataURL(blob)
    })
  } catch (_) {
    return url
  }
}

/**
 * Inline all <img> elements inside a cloned DOM tree as Base64 data URLs
 */
async function inlineAllImages(rootEl) {
  const imgs = Array.from(rootEl.querySelectorAll('img'))
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src')
      if (src && !src.startsWith('data:')) {
        const dataUrl = await imageUrlToDataUrl(src)
        img.setAttribute('src', dataUrl)
      }
      if (img.decode) {
        try {
          await img.decode()
        } catch (_) {}
      }
    })
  )
}

/**
 * Extract all <a href="..."> bounding boxes in millimeter coordinates (210mm x 297mm)
 * so we can overlay clickable hyperlink annotations onto the generated PDF page.
 */
function extractPageLinksInMm(pageEl) {
  const pageRect = pageEl.getBoundingClientRect()
  if (!pageRect.width || !pageRect.height) return []

  const scaleX = 210 / pageRect.width
  const scaleY = 297 / pageRect.height
  const links = []

  pageEl.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')
    if (!href) return
    const rect = a.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return

    links.push({
      url: href,
      x: (rect.left - pageRect.left) * scaleX,
      y: (rect.top - pageRect.top) * scaleY,
      w: rect.width * scaleX,
      h: rect.height * scaleY
    })
  })

  return links
}

/**
 * Directly generate and download a multi-page A4 PDF file without opening the browser print dialog.
 * Preserves 100% of CSS themes, skill badges, custom fonts, margins, and clickable hyperlinks.
 */
export async function exportResumeToPdf({ pagesContainer, title = '个人简历' }) {
  if (!pagesContainer) {
    throw new Error('未找到预览画布容器')
  }

  const sourcePages = Array.from(pagesContainer.querySelectorAll('.a4-page'))
  if (!sourcePages.length) {
    throw new Error('暂无可导出的简历页面')
  }

  // Create an unscaled (zoom: 1) offscreen staging container so preview zoom never distorts capture
  const stagingRoot = document.createElement('div')
  stagingRoot.className = 'pdf-export-staging'
  document.body.appendChild(stagingRoot)

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    })

    for (let i = 0; i < sourcePages.length; i++) {
      const originalPage = sourcePages[i]
      const clonedPage = originalPage.cloneNode(true)

      // Clean up interactive preview states before rendering
      clonedPage.classList.remove('active-page')
      clonedPage.style.boxShadow = 'none'
      clonedPage.style.outline = 'none'
      clonedPage.style.margin = '0'
      clonedPage
        .querySelectorAll('.source-jump-highlight, .is-dragging')
        .forEach((el) => el.classList.remove('source-jump-highlight', 'is-dragging'))

      stagingRoot.innerHTML = ''
      stagingRoot.appendChild(clonedPage)

      // Ensure all images (such as avatars) are inlined and decoded
      await inlineAllImages(clonedPage)

      // Measure clickable links while clonedPage is mounted at 1:1 scale
      const links = extractPageLinksInMm(clonedPage)

      const dataUrl = await toJpeg(clonedPage, {
        quality: 0.96,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        cacheBust: true
      })

      if (i > 0) {
        pdf.addPage('a4', 'portrait')
      }

      pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')

      // Overlay clickable hyperlink hot-zones on the PDF page
      links.forEach(({ x, y, w, h, url }) => {
        pdf.link(x, y, w, h, { url })
      })
    }

    const safeFileName = (title || '个人简历').replace(/[\\/:*?"<>|]/g, '_').trim() || '个人简历'
    pdf.save(`${safeFileName}.pdf`)
  } finally {
    stagingRoot.remove()
  }
}

/**
 * Directly generate and download a high-resolution 300DPI PNG image of the resume.
 * If the resume has multiple A4 pages, stitches them vertically into one seamless long image.
 */
export async function exportResumeToPng({ pagesContainer, title = '个人简历' }) {
  if (!pagesContainer) {
    throw new Error('未找到预览画布容器')
  }

  const sourcePages = Array.from(pagesContainer.querySelectorAll('.a4-page'))
  if (!sourcePages.length) {
    throw new Error('暂无可导出的简历页面')
  }

  // NOTE: `.pdf-export-staging` is positioned off-screen (fixed / left: -12000px). html-to-image copies the
  // captured node's own computed styles onto its clone, so capturing the staging root itself renders the
  // content outside the canvas (blank image). Capture an inner statically-positioned wrapper instead.
  const stagingRoot = document.createElement('div')
  stagingRoot.className = 'pdf-export-staging'
  const captureWrapper = document.createElement('div')
  const isMultiPage = sourcePages.length > 1
  const wrapperBg = isMultiPage ? '#e2e8f0' : '#ffffff'
  captureWrapper.style.cssText = [
    'position: static',
    'display: flex',
    'flex-direction: column',
    `gap: ${isMultiPage ? '14px' : '0px'}`,
    `padding: ${isMultiPage ? '14px' : '0px'}`,
    `background: ${wrapperBg}`,
    'width: 210mm',
    'box-sizing: content-box'
  ].join(';')
  stagingRoot.appendChild(captureWrapper)
  document.body.appendChild(stagingRoot)

  try {
    for (let i = 0; i < sourcePages.length; i++) {
      const clonedPage = sourcePages[i].cloneNode(true)
      clonedPage.classList.remove('active-page')
      clonedPage.style.boxShadow = 'none'
      clonedPage.style.outline = 'none'
      clonedPage.style.margin = '0'
      clonedPage
        .querySelectorAll('.source-jump-highlight, .is-dragging')
        .forEach((el) => el.classList.remove('source-jump-highlight', 'is-dragging'))

      captureWrapper.appendChild(clonedPage)
      await inlineAllImages(clonedPage)
    }

    // Browsers cap canvas size (~16384px per side, and a total-area limit). Exceeding it yields a blank image,
    // so scale the resolution down automatically for tall multi-page long images.
    const MAX_CANVAS_SIDE = 15000
    const wrapperRect = captureWrapper.getBoundingClientRect()
    const longestSide = Math.max(wrapperRect.width, wrapperRect.height, 1)
    const safePixelRatio = Math.max(1, Math.min(3, MAX_CANVAS_SIDE / longestSide))

    const dataUrl = await toPng(captureWrapper, {
      pixelRatio: safePixelRatio,
      backgroundColor: wrapperBg,
      cacheBust: true
    })

    const safeFileName = (title || '个人简历').replace(/[\\/:*?"<>|]/g, '_').trim() || '个人简历'
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${safeFileName}.png`
    a.click()
  } finally {
    stagingRoot.remove()
  }
}

/**
 * Trigger browser native vector print with automatic document.title synchronization
 */
export function triggerVectorPrint(title = '个人简历') {
  const originalTitle = document.title
  const cleanTitle = (title || '个人简历').trim() || '个人简历'
  document.title = cleanTitle

  const restoreTitle = () => {
    document.title = originalTitle
    window.removeEventListener('afterprint', restoreTitle)
  }

  window.addEventListener('afterprint', restoreTitle)
  window.print()

  // Fallback restore in case afterprint does not fire in some environments
  setTimeout(restoreTitle, 3000)
}

