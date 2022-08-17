import { ChangeEvent, useCallback, useEffect, useRef, useState, MouseEvent } from 'react'
import * as pdfjs from 'pdfjs-dist'
import './App.css'
import { PDFDocument } from 'pdf-lib'
import { SketchPicker } from 'react-color'

pdfjs.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.js'

const Fonts = [
  'Arial',
  'Verdana',
  'Helvetica',
  'Tahoma',
  'Trebuchet',
  'Times',
  'Georgia',
  'Garamond',
  'Courier',
  'Brush'
] as const

function App() {
  const cvs = useRef<HTMLCanvasElement>(null)
  const cvs2 = useRef<HTMLCanvasElement>(null)
  const ctx = useRef<CanvasRenderingContext2D | null>(null)
  const ctx2 = useRef<CanvasRenderingContext2D | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPage, setTotalPage] = useState(0)
  const [mode, setMode] = useState<'text' | 'line' | 'draw'>('draw')
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [mouseDown, setMouseDown] = useState(false)
  const [scale, setScale] = useState(2.1)
  const [pdfBuffer, setPdfBuffer] = useState<Uint8Array | null>(null)
  const [pdfName, setPdfName] = useState('')
  const [strokeWidth, setStrokeWidth] = useState(1)
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [showColorPickerModal, setShowColorPickerModal] = useState(false)
  const pdfHistory = useRef<Array<Uint8Array>>([])
  const [textBoxPos, setTextBoxPos] = useState({ x: 0, y: 0 })
  const [text, setText] = useState('')
  const [font, setFont] = useState<typeof Fonts[number]>('Helvetica')
  
  const onFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files![0]
    
    if (file) {
      const fileReader = new FileReader()
      fileReader.onload = async (e) => {
        const res = e.target?.result as ArrayBufferLike
        if (res) {
          setPdfBuffer(new Uint8Array(res))
          setPdfName(file.name)
        }
      }
      fileReader.readAsArrayBuffer(file)
      e.target.value = ''
    }
  }

  const downloadPdf = () => {
    const blob = new Blob([pdfBuffer!.buffer], { type: 'application/pdf' })
    const a = document.createElement('a')
    a.href = window.URL.createObjectURL(blob)
    a.download = pdfName
    document.body.appendChild(a)
    a.style.display = 'none'
    a.click()
    a.remove()
  }

  const draw = useCallback((x: number, y: number) => {
    if (mouseDown && ctx2.current) {
      ctx2.current.beginPath()
      ctx2.current.strokeStyle = strokeColor
      ctx2.current.lineWidth = strokeWidth
      ctx2.current.lineJoin = 'round'
      ctx2.current.moveTo(lastPos.x, lastPos.y)
      ctx2.current.lineTo(x, y)
      ctx2.current.closePath()
      ctx2.current.stroke()
      setLastPos({ x, y })
    }
  }, [lastPos, mouseDown, setLastPos])

  useEffect(() => {
    if (mode !== 'text') return
    const drawText = () => {
      if (ctx2.current) {
        ctx2.current!.clearRect(0, 0, cvs2.current!.width, cvs2.current!.height)
        ctx2.current.font = `${strokeWidth}px ${font}`
        ctx2.current.fillStyle = strokeColor
        text.split('\n').forEach((line, i) => {
          ctx2.current!.fillText(line, textBoxPos.x, textBoxPos.y + ((i * strokeWidth) + strokeWidth / 2))
        })
      }
    }
    drawText()
  }, [text, textBoxPos, strokeWidth, font, strokeColor])

  const onMouseDown = (e: MouseEvent) => {
    const offSetLeft = cvs2.current!.offsetLeft
    const offSetTop = cvs2.current!.offsetTop
    const x = e.pageX - offSetLeft
    const y = e.pageY - offSetTop
    switch (mode) {
      case 'line':
        setLastPos({ x, y })
      case 'draw':
        setLastPos({ x, y })
        setMouseDown(true)
        ctx2.current!.fillStyle = strokeColor
        ctx2.current!.beginPath();
        ctx2.current!.arc(x, y, strokeWidth / 2, 0, 2 * Math.PI)
        ctx2.current!.fill()
      case 'text':
        setMouseDown(true)
    }
  }

  const onMouseUpOrLeave = (e: MouseEvent) => { 
    if (mode === 'line') {
      const offSetLeft = cvs2.current!.offsetLeft
      const offSetTop = cvs2.current!.offsetTop
      const x = e.pageX - offSetLeft
      const y = e.pageY - offSetTop
    }
    setMouseDown(false)
  }

  const onMouseMove = (e: MouseEvent) => {
    const offSetLeft = cvs2.current!.offsetLeft
    const offSetTop = cvs2.current!.offsetTop
    const x = e.pageX - offSetLeft
    const y = e.pageY - offSetTop
    switch (mode) {
      case 'draw':
        draw(x, y)
      case 'text':
        if (mouseDown) {
          setTextBoxPos({ x, y })
        }
    }
  }

  const saveChanges = async () => {
    if (!pdfBuffer) return
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const page = pdfDoc.getPage(currentPage - 1)
    const { width, height } = page.getSize()
    const img = cvs2.current!.toDataURL('image/png')
    const pngImg = await pdfDoc.embedPng(img)
    page.drawImage(pngImg, {
      x: 0,
      y: 0,
      width,
      height
    })
    const pdfBytes = await pdfDoc.save()
    const base64 = await pdfDoc.saveAsBase64()
    if (pdfHistory.current.length > 5) {
      pdfHistory.current.shift()
    }
    pdfHistory.current.push(pdfBuffer)
    setPdfBuffer(pdfBytes)
  }

  const undo = () => {
    const prev = pdfHistory.current.pop()
    if (!prev) return
    setPdfBuffer(prev)
  }

  useEffect(() => {
    const renderPdf = async () => {
      if (!pdfBuffer || !cvs.current || !cvs2.current) return
      ctx.current = cvs.current!.getContext('2d') || new CanvasRenderingContext2D()
      ctx2.current = cvs2.current!.getContext('2d') || new CanvasRenderingContext2D()
      const pdfjsDoc = await pdfjs.getDocument(pdfBuffer).promise
      setTotalPage(pdfjsDoc.numPages)
      const page = await pdfjsDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale })
      cvs.current!.height = viewport.height
      cvs.current!.width = viewport.width
      cvs2.current!.height = viewport.height
      cvs2.current!.width = viewport.width
      await page.render({ canvasContext: ctx.current, viewport })
    }
    renderPdf()
  }, [pdfBuffer, currentPage, scale, mode])

  const selectColorButton = () => {
    return <button onClick={() => setShowColorPickerModal(val => !val)} type="button" className={`border-2 border-slate-400 rounded-lg px-4 py-2`} style={{ backgroundColor: strokeColor }}></button>
  }

  const editModeUtil = () => {
    switch (mode) {
      case 'draw':
      case 'line':
        return (
          <div className="flex space-x-2">
            <div className='flex'>
              <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 rounded-l-md border border-r-0 border-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
                Stroke Width
              </span>
              <input type="number" value={strokeWidth} onChange={(e) => setStrokeWidth(parseFloat(e.target.value) || 1)} className="rounded-none rounded-r-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 text-sm border-gray-300 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 w-[80px]" />
            </div>
            {selectColorButton()}
          </div>
        )
      case 'text':
        return (
          <div className='flex flex-col items-center'>
            <div className="flex space-x-2">
              <div className='flex'>
                <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 rounded-l-md border border-r-0 border-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
                  Font Size (px)
                </span>
                <input type="number" value={strokeWidth} onChange={(e) => setStrokeWidth(parseFloat(e.target.value) || 1)} className="rounded-none rounded-r-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 text-sm border-gray-300 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 w-[80px]" />
              </div>
              <div className='flex'>
                <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 rounded-l-md border border-r-0 border-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
                  Font Fam
                </span>
                <select value={font} onChange={(e) => setFont(e.target.value as typeof Fonts[number])} className="rounded-none rounded-r-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 text-sm border-gray-300 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 w-[150px]">
                  {Fonts.map((f, i) => <option key={i} value={f}>{f}</option>)}
                </select>
              </div>
              {selectColorButton()}
            </div>
            <div>
              <label htmlFor="message" className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-400">Your text</label>
              <textarea onChange={(e) => setText(e.target.value)} id="message" rows={4} cols={50} className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500" placeholder="Your message..."></textarea>
            </div>
          </div>
        )
      default: 
        return
    }
  }

  const colorPickerModal = () => {
    if (!showColorPickerModal) return
    return (
      <div className="overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 z-50 w-full md:inset-0 h-modal md:h-full">
        <div className="relative p-4 w-full max-w-2xl h-full mx-auto mt-[10%]">
          <div className="relative bg-white rounded-lg shadow dark:bg-gray-700">
            <div className="flex justify-between items-start p-4 rounded-t border-b dark:border-gray-600">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Select Color
              </h3>
              <button onClick={() => setShowColorPickerModal(val => !val)} type="button" className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white">
                  <svg aria-hidden="true" className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                  <span className="sr-only">Close modal</span>
              </button>
            </div>
            <div className="flex justify-center items-center p-6">
              <SketchPicker color={strokeColor} onChangeComplete={(color) => setStrokeColor(color.hex)} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex'>
      <div className='flex flex-col w-fit m-auto space-y-4'>
        <div className='flex justify-center space-x-10 mt-4'>
          <div>
            <input ref={input} type={'file'} accept=".pdf" onChange={onFileUpload} className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400" />
          </div>
          <button onClick={() => saveChanges()} type="button" className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800">Save</button>
          <button onClick={() => undo()} type="button" className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800">Undo</button>
          <button onClick={() => ctx2.current!.clearRect(0, 0, cvs2.current!.width, cvs2.current!.height)} type="button" className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800">Clear</button>
          <button onClick={() => downloadPdf()} type="button" className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800">Download</button>
        </div>
        <div className='flex justify-center items-center space-x-4'>
          <svg onClick={() => setMode('draw')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M224 263.3C224.2 233.3 238.4 205.2 262.4 187.2L499.1 9.605C517.7-4.353 543.6-2.965 560.7 12.9C577.7 28.76 580.8 54.54 568.2 74.07L406.5 324.1C391.3 347.7 366.6 363.2 339.3 367.1L224 263.3zM320 400C320 461.9 269.9 512 208 512H64C46.33 512 32 497.7 32 480C32 462.3 46.33 448 64 448H68.81C86.44 448 98.4 429.1 96.59 411.6C96.2 407.8 96 403.9 96 400C96 339.6 143.9 290.3 203.7 288.1L319.8 392.5C319.9 394.1 320 397.5 320 400V400z"/></svg>
          <svg onClick={() => setMode('text')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M381.5 435.7l-160-384C216.6 39.78 204.9 32.01 192 32.01S167.4 39.78 162.5 51.7l-160 384c-6.797 16.31 .9062 35.05 17.22 41.84c16.38 6.828 35.08-.9219 41.84-17.22l31.8-76.31h197.3l31.8 76.31c5.109 12.28 17.02 19.7 29.55 19.7c4.094 0 8.266-.7969 12.3-2.484C380.6 470.7 388.3 452 381.5 435.7zM119.1 320L192 147.2l72 172.8H119.1z"/></svg>
          <svg onClick={() => setMode('line')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M62.36 458.1C56.77 474.9 38.65 483.9 21.88 478.4C5.116 472.8-3.946 454.6 1.643 437.9L129.6 53.88C135.2 37.12 153.4 28.05 170.1 33.64C186.9 39.23 195.9 57.35 190.4 74.12L62.36 458.1zM261.3 32.44C278.7 35.34 290.5 51.83 287.6 69.26L223.6 453.3C220.7 470.7 204.2 482.5 186.7 479.6C169.3 476.7 157.5 460.2 160.4 442.7L224.4 58.74C227.3 41.31 243.8 29.53 261.3 32.44H261.3zM352 32C369.7 32 384 46.33 384 64V448C384 465.7 369.7 480 352 480C334.3 480 320 465.7 320 448V64C320 46.33 334.3 32 352 32V32z"/></svg>
        </div>
        <div className='flex justify-center items-center space-x-[50px]'>
          <svg onClick={() => setCurrentPage((v) => v - 1 > 0 ? v - 1 : v)} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path d="M137.4 406.6l-128-127.1C3.125 272.4 0 264.2 0 255.1s3.125-16.38 9.375-22.63l128-127.1c9.156-9.156 22.91-11.9 34.88-6.943S192 115.1 192 128v255.1c0 12.94-7.781 24.62-19.75 29.58S146.5 415.8 137.4 406.6z"/></svg>
          <span>Page: {currentPage}</span>
          <svg onClick={() => setCurrentPage((v) => v + 1 <= totalPage ? v + 1 : v)} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path d="M118.6 105.4l128 127.1C252.9 239.6 256 247.8 256 255.1s-3.125 16.38-9.375 22.63l-128 127.1c-9.156 9.156-22.91 11.9-34.88 6.943S64 396.9 64 383.1V128c0-12.94 7.781-24.62 19.75-29.58S109.5 96.23 118.6 105.4z"/></svg>
        </div>
        <span className='text-center'>{pdfName}</span>
        <div className='flex justify-center items-center space-x-5 text-lg'>
          <button onClick={() => setScale((v) => v + 0.2)} type="button" className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800">+</button>
          <span>zoom</span>
          <button onClick={() => setScale((v) => v - 0.2)} type="button" className="focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900">-</button>
        </div>
        <span className='text-center'>{mode.toUpperCase()}</span>
        <div className='flex justify-center items-center space-x-2'>
          {editModeUtil()}
        </div>
        <div className='border-2'>
          <canvas
            ref={cvs}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseUpOrLeave}
            onMouseUp={onMouseUpOrLeave}
            onMouseMove={onMouseMove}
          ></canvas>
          <canvas
            style={cvs.current ? { top: `${-cvs.current.height}px` } : {}}
            className={`relative z-10`}
            ref={cvs2}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseUpOrLeave}
            onMouseUp={onMouseUpOrLeave}
            onMouseMove={onMouseMove}
          ></canvas>
        </div>
      </div>
      {colorPickerModal()}
    </div>
  )
}

export default App
