import { ChangeEvent, useCallback, useEffect, useRef, useState, MouseEvent } from 'react'
import * as pdfjs from 'pdfjs-dist'
import './App.css'
import { PDFDocument } from 'pdf-lib'

pdfjs.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.js'

function App() {
  const cvs = useRef<HTMLCanvasElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPage, setTotalPage] = useState(0)
  // const [pdfjsDoc, setPdfjsDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [mode, setMode] = useState<'text' | 'line' | 'draw'>('text')
  const ctx = useRef<CanvasRenderingContext2D | null>(null)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [mouseDown, setMouseDown] = useState(false)
  const [scale, setScale] = useState(1)
  const [pdfBuffer, setPdfBuffer] = useState<Uint8Array | null>(null)
  
  const onFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files![0]
    
    if (file) {
      const fileReader = new FileReader()
      fileReader.onload = async (e) => {
        const res = e.target?.result as ArrayBufferLike
        if (res) {
          setPdfBuffer(new Uint8Array(res))
        }
      }
      fileReader.readAsArrayBuffer(file)
      e.target.value = ''
    }
  }

  const draw = useCallback((x: number, y: number) => {
    if (mouseDown && ctx.current) {
      ctx.current.beginPath()
      ctx.current.strokeStyle = '#000000'
      ctx.current.lineWidth = 10
      ctx.current.lineJoin = 'round'
      ctx.current.moveTo(lastPos.x, lastPos.y)
      ctx.current.lineTo(x, y)
      ctx.current.stroke()
      ctx.current.closePath()
      setLastPos({ x, y })
    }
  }, [lastPos, mouseDown, setLastPos])

  const onMouseDown = (e: MouseEvent) => {
    const offSetLeft = cvs.current!.offsetLeft
    const offSetTop = cvs.current!.offsetTop
    const x = e.pageX - offSetLeft
    const y = e.pageY - offSetTop
    setLastPos({ x, y })
    setMouseDown(true)
    ctx.current!.beginPath()
    ctx.current!.fillStyle = '#000000'
    ctx.current!.fillRect(x - 5, y - 5, 10, 10);
    ctx.current!.closePath();
  }

  const onMouseUpOrLeave = (e: MouseEvent) => {
    setMouseDown(false)
  }

  const onMouseMove = (e: MouseEvent) => {
    const offSetLeft = cvs.current!.offsetLeft
    const offSetTop = cvs.current!.offsetTop
    draw(e.pageX - offSetLeft, e.pageY - offSetTop)
  }

  const saveChanges = async () => {
    if (!pdfBuffer) return
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const page = pdfDoc.getPage(currentPage - 1)
    const { width, height } = page.getSize()
    const img = cvs.current!.toDataURL('image/png')
    const pngImg = await pdfDoc.embedPng(img)
    page.drawImage(pngImg, {
      x: 0,
      y: 0,
      width,
      height
    })
    const pdfBytes = await pdfDoc.save()
    const base64 = await pdfDoc.saveAsBase64()
    console.log('base64 :>> ', base64)
    setPdfBuffer(pdfBytes)
  }

  useEffect(() => {
    const renderPdf = async () => {
      if (!pdfBuffer || !cvs.current) return
      ctx.current = cvs.current!.getContext('2d') || new CanvasRenderingContext2D()
      const pdfjsDoc = await pdfjs.getDocument(pdfBuffer).promise
      setTotalPage(pdfjsDoc.numPages)
      const page = await pdfjsDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale })
      cvs.current!.height = viewport.height
      cvs.current!.width = viewport.width
      await page.render({ canvasContext: ctx.current, viewport })
    }
    renderPdf()
  }, [pdfBuffer, currentPage, scale])

  return (
    <div className='flex'>
      <div className='flex flex-col w-fit m-auto space-y-4'>
        <div className='flex justify-center space-x-10'>
          <input ref={input} type={'file'} accept=".pdf" onChange={onFileUpload} />
          <button onClick={() => saveChanges()} type="button" className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800">Save</button>
        </div>
        <div className='flex justify-center items-center space-x-4'>
          <svg onClick={() => setMode('text')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M381.5 435.7l-160-384C216.6 39.78 204.9 32.01 192 32.01S167.4 39.78 162.5 51.7l-160 384c-6.797 16.31 .9062 35.05 17.22 41.84c16.38 6.828 35.08-.9219 41.84-17.22l31.8-76.31h197.3l31.8 76.31c5.109 12.28 17.02 19.7 29.55 19.7c4.094 0 8.266-.7969 12.3-2.484C380.6 470.7 388.3 452 381.5 435.7zM119.1 320L192 147.2l72 172.8H119.1z"/></svg>
          <svg onClick={() => setMode('line')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M62.36 458.1C56.77 474.9 38.65 483.9 21.88 478.4C5.116 472.8-3.946 454.6 1.643 437.9L129.6 53.88C135.2 37.12 153.4 28.05 170.1 33.64C186.9 39.23 195.9 57.35 190.4 74.12L62.36 458.1zM261.3 32.44C278.7 35.34 290.5 51.83 287.6 69.26L223.6 453.3C220.7 470.7 204.2 482.5 186.7 479.6C169.3 476.7 157.5 460.2 160.4 442.7L224.4 58.74C227.3 41.31 243.8 29.53 261.3 32.44H261.3zM352 32C369.7 32 384 46.33 384 64V448C384 465.7 369.7 480 352 480C334.3 480 320 465.7 320 448V64C320 46.33 334.3 32 352 32V32z"/></svg>
          <svg onClick={() => setMode('draw')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M224 263.3C224.2 233.3 238.4 205.2 262.4 187.2L499.1 9.605C517.7-4.353 543.6-2.965 560.7 12.9C577.7 28.76 580.8 54.54 568.2 74.07L406.5 324.1C391.3 347.7 366.6 363.2 339.3 367.1L224 263.3zM320 400C320 461.9 269.9 512 208 512H64C46.33 512 32 497.7 32 480C32 462.3 46.33 448 64 448H68.81C86.44 448 98.4 429.1 96.59 411.6C96.2 407.8 96 403.9 96 400C96 339.6 143.9 290.3 203.7 288.1L319.8 392.5C319.9 394.1 320 397.5 320 400V400z"/></svg>
        </div>
        <div className='flex justify-center items-center space-x-[50px]'>
          <svg onClick={() => setCurrentPage((v) => v - 1 > 0 ? v - 1 : v)} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path d="M137.4 406.6l-128-127.1C3.125 272.4 0 264.2 0 255.1s3.125-16.38 9.375-22.63l128-127.1c9.156-9.156 22.91-11.9 34.88-6.943S192 115.1 192 128v255.1c0 12.94-7.781 24.62-19.75 29.58S146.5 415.8 137.4 406.6z"/></svg>
          <span>{currentPage}</span>
          <svg onClick={() => setCurrentPage((v) => v + 1 <= totalPage ? v + 1 : v)} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path d="M118.6 105.4l128 127.1C252.9 239.6 256 247.8 256 255.1s-3.125 16.38-9.375 22.63l-128 127.1c-9.156 9.156-22.91 11.9-34.88 6.943S64 396.9 64 383.1V128c0-12.94 7.781-24.62 19.75-29.58S109.5 96.23 118.6 105.4z"/></svg>
        </div>
        <div className='flex justify-center space-x-5 text-lg'>
          <button onClick={() => setScale((v) => v + 0.2)} type="button" className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800">+</button>
          <button onClick={() => setScale((v) => v - 0.2)} type="button" className="focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900">-</button>
        </div>
        <span className='text-center'>{mode.toUpperCase()}</span>
        <canvas
          className='border-2'
          ref={cvs}
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseUpOrLeave}
          onMouseUp={onMouseUpOrLeave}
          onMouseMove={onMouseMove}
        ></canvas>
      </div>
    </div>
  )
}

export default App
