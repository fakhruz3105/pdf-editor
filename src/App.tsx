import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
  MouseEvent,
  useMemo,
} from "react";
import * as pdfjs from "pdfjs-dist";
import "./App.css";
import { PDFDocument, drawText } from "pdf-lib";
import { SketchPicker } from "react-color";

pdfjs.GlobalWorkerOptions.workerSrc =
  "//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.js";

const Fonts = [
  "Arial",
  "Verdana",
  "Helvetica",
  "Tahoma",
  "Trebuchet",
  "Times",
  "Georgia",
  "Garamond",
  "Courier",
  "Brush",
] as const;

enum Mode {
  Draw,
  Text,
  Line,
  Image,
  Rect
}

type Pos = {
  x: number;
  y: number;
};

interface PageCanvas {
  display: HTMLCanvasElement;
  drawing: HTMLCanvasElement;
  lastPos: Pos;
  textBoxPos: Pos;
  imagePos: Pos;
  mouseDown: boolean;
}

function App() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPage, setTotalPage] = useState(0);
  const [mode, setMode] = useState<Mode>(Mode.Draw);
  const [scale, setScale] = useState(2.1);
  const [pdfBuffer, setPdfBuffer] = useState<Uint8Array | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [strokeWidth, setStrokeWidth] = useState(10);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [showColorPickerModal, setShowColorPickerModal] = useState(false);
  const pdfHistory = useRef<Array<Uint8Array>>([]);
  const [text, setText] = useState("");
  const [font, setFont] = useState<(typeof Fonts)[number]>("Helvetica");
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageHeight, setImageHeight] = useState(50);
  const [imageWidth, setImageWidth] = useState(50);

  const [cvss, setCvss] = useState<PageCanvas[]>([]);

  const onFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files![0];

    if (file) {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const res = e.target?.result as ArrayBufferLike;
        if (res) {
          setPdfBuffer(new Uint8Array(res));
          setPdfName(file.name);
        }
      };
      fileReader.readAsArrayBuffer(file);
      e.target.value = "";
    }
  };

  const onImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files![0];

    if (file) {
      const fileReader = new FileReader();
      fileReader.onloadend = async (e) => {
        const myImage = new Image();
        myImage.src = e.target!.result as string;
        setImage(myImage);
        setImageHeight(myImage.height);
        setImageWidth(myImage.width);
      };
      fileReader.readAsDataURL(file);
      e.target.value = "";
    }
  };

  const downloadPdf = () => {
    const blob = new Blob([pdfBuffer!.buffer], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(blob);
    a.download = pdfName;
    document.body.appendChild(a);
    a.style.display = "none";
    a.click();
    a.remove();
  };

  const draw = (
    pageNumber: number,
    lastPos: Pos,
    currentPos: Pos,
    ctx: CanvasRenderingContext2D
  ) => {
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = "round";
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.closePath();
    ctx.stroke();
    setCvss((oldVal) => {
      return oldVal.map((e, i) => {
        if (i === pageNumber) {
          return {
            ...e,
            lastPos: { x: currentPos.x, y: currentPos.y },
          };
        }
        return e;
      });
    });
  };

  const drawText = (
    textBoxPos: Pos,
    cvs: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) => {
    ctx!.clearRect(0, 0, cvs!.width, cvs!.height);
    ctx.font = `${strokeWidth}px ${font}`;
    ctx.fillStyle = strokeColor;
    text.split("\n").forEach((line, i) => {
      ctx!.fillText(
        line,
        textBoxPos.x,
        textBoxPos.y + (i * strokeWidth + strokeWidth / 2)
      );
    });
  };

  const drawImage = (
    imageBoxPos: Pos,
    cvs: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) => {
    if (image) {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(
        image,
        imageBoxPos.x,
        imageBoxPos.y,
        imageWidth,
        imageHeight
      );
    }
  };

  const drawRectangle = (
    rectPos: Pos,
    cvs: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) => {
    ctx.rect(rectPos.x, rectPos.y, 100, 100)
  }

  const onMouseDown = (e: MouseEvent, pageNumber: number) => {
    const cvs = cvss[pageNumber].drawing;
    const ctx = cvs.getContext("2d")!;
    const offSetLeft = cvs.offsetLeft;
    const offSetTop = cvs.offsetTop;
    const x = e.pageX - offSetLeft;
    const y = e.pageY - offSetTop;

    switch (mode) {
      case Mode.Line:
      case Mode.Draw:
        setCvss((oldVal) => {
          return oldVal.map((e, i) => {
            if (i === pageNumber) {
              return {
                ...e,
                lastPos: { x, y },
                mouseDown: true,
              };
            }
            return e;
          });
        });
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(x, y, strokeWidth / 2, 0, 2 * Math.PI);
        ctx.fill();
        break;
      case Mode.Text:
        drawText({ x, y }, cvs, ctx);
        setCvss((oldVal) => {
          return oldVal.map((e, i) => {
            if (i === pageNumber) {
              return {
                ...e,
                mouseDown: true,
              };
            }
            return e;
          });
        });
        break;
      case Mode.Image:
        setCvss((oldVal) => {
          return oldVal.map((e, i) => {
            if (i === pageNumber) {
              return {
                ...e,
                mouseDown: true,
              };
            }
            return e;
          });
        });
        break;
    }
  };

  const onMouseUpOrLeave = (e: MouseEvent, pageNumber: number) => {
    const cvs = cvss[pageNumber].drawing;
    const ctx = cvs.getContext("2d")!;
    const offSetLeft = cvs.offsetLeft;
    const offSetTop = cvs.offsetTop;
    const x = e.pageX - offSetLeft;
    const y = e.pageY - offSetTop;
    const mouseDown = cvss[pageNumber].mouseDown;

    switch (mode) {
      case Mode.Line:
        if (mouseDown) {
          draw(pageNumber, cvss[pageNumber].lastPos, { x, y }, ctx);
        }
        break;
    }

    setCvss((oldVal) => {
      return oldVal.map((e, i) => {
        if (i === pageNumber) {
          return {
            ...e,
            mouseDown: false,
          };
        }
        return e;
      });
    });
  };

  const onMouseMove = (e: MouseEvent, pageNumber: number) => {
    const cvs = cvss[pageNumber].drawing;
    const ctx = cvs.getContext("2d")!;
    const offSetLeft = cvs.offsetLeft;
    const offSetTop = cvs.offsetTop;
    const x = e.pageX - offSetLeft;
    const y = e.pageY - offSetTop;
    const mouseDown = cvss[pageNumber].mouseDown;

    switch (mode) {
      case Mode.Draw:
        if (mouseDown) {
          draw(pageNumber, cvss[pageNumber].lastPos, { x, y }, ctx);
        }
        break;
      case Mode.Text:
        if (mouseDown) {
          drawText({ x, y }, cvs, ctx);
          setCvss((oldVal) => {
            return oldVal.map((e, i) => {
              if (i === pageNumber) {
                return {
                  ...e,
                  textBoxPos: { x, y },
                };
              }
              return e;
            });
          });
        }
        break;
      case Mode.Image:
        if (mouseDown) {
          drawImage({ x, y }, cvs, ctx);
          setCvss((oldVal) => {
            return oldVal.map((e, i) => {
              if (i === pageNumber) {
                return {
                  ...e,
                  imagePos: { x, y },
                };
              }
              return e;
            });
          });
        }
        break;
    }
  };

  const saveChanges = async () => {
    if (!pdfBuffer) return;
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    for (const [i, page] of pages.entries()) {
      const { width, height } = page.getSize();
      const img = cvss[i].drawing.toDataURL("image/png");
      const pngImg = await pdfDoc.embedPng(img);
      page.drawImage(pngImg, {
        x: 0,
        y: 0,
        width,
        height,
      });
    }

    const pdfBytes = await pdfDoc.save();
    if (pdfHistory.current.length > 5) {
      pdfHistory.current.shift();
    }
    pdfHistory.current.push(pdfBuffer);
    setPdfBuffer(pdfBytes);
  };

  const undo = () => {
    const prev = pdfHistory.current.pop();
    if (!prev) return;
    setPdfBuffer(prev);
  };

  useEffect(() => {
    const renderAllPages = async () => {
      if (!pdfBuffer) return;
      const pdfjsDoc = await pdfjs.getDocument(pdfBuffer).promise;
      const numOfPages = pdfjsDoc.numPages;
      const mainDiv = document.getElementById("pages");
      mainDiv!.innerHTML = "";
      const cvss: PageCanvas[] = [];

      for (let pageNum = 1; pageNum <= numOfPages; pageNum++) {
        const div = document.createElement("div");
        div.className = "grid rounded-sm";
        div.style.boxShadow = "0 0 0 5px #9e9e9e";
        const cvs1 = document.createElement("canvas");
        const cvs2 = document.createElement("canvas");
        cvs1.className = "col-[1_/_-1] row-[1_/_-1]";
        cvs2.className = "col-[1_/_-1] row-[1_/_-1]";
        div.appendChild(cvs1);
        div.appendChild(cvs2);
        const ctx1 = cvs1.getContext("2d") || new CanvasRenderingContext2D();
        const ctx2 = cvs2.getContext("2d") || new CanvasRenderingContext2D();
        div.addEventListener("mouseenter", () => {
          div.style.boxShadow = "0 0 0 5px #ee6352";
        });

        div.addEventListener("mouseleave", () => {
          div.style.boxShadow = "0 0 0 5px #9e9e9e";
        });

        const page = await pdfjsDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        cvs1.height = viewport.height;
        cvs1.width = viewport.width;
        cvs2.height = viewport.height;
        cvs2.width = viewport.width;
        cvss.push({
          display: cvs1,
          drawing: cvs2,
          lastPos: { x: 0, y: 0 },
          textBoxPos: { x: 0, y: 0 },
          imagePos: { x: 0, y: 0 },
          mouseDown: false,
        });
        await page.render({ canvasContext: ctx1, viewport });
        mainDiv!.appendChild(div);
      }

      setCvss(cvss);
    };
    renderAllPages();
  }, [pdfBuffer, currentPage, scale, mode]);

  useEffect(() => {
    cvss.forEach((cvs, pageNum) => {
      cvs.drawing.onmousedown = (e) => {
        onMouseDown(e as any, pageNum);
      };
      cvs.drawing.onmousemove = (e) => {
        onMouseMove(e as any, pageNum);
      };
      cvs.drawing.onmouseup = (e) => {
        onMouseUpOrLeave(e as any, pageNum);
      };
      cvs.drawing.onmouseleave = (e) => {
        onMouseUpOrLeave(e as any, pageNum);
      };
    });
  }, [cvss]);

  const clearCanvas = () => {
    cvss.forEach(cvs => {
      const canvas = cvs.drawing;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    })
  }

  const colorPickerModal = (() => {
    if (!showColorPickerModal) return;
    return (
      <div className="absolute p-4 w-full max-w-2xl h-full mx-auto mt-[10%]">
        <div className="relative bg-white rounded-lg shadow dark:bg-gray-700">
          <div className="flex justify-between items-start p-4 rounded-t border-b dark:border-gray-600">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Select Color
            </h3>
            <button
              onClick={() => setShowColorPickerModal((val) => !val)}
              type="button"
              className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white"
            >
              <svg
                aria-hidden="true"
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                ></path>
              </svg>
              <span className="sr-only">Close modal</span>
            </button>
          </div>
          <div className="flex justify-center items-center p-6">
            <SketchPicker
              color={strokeColor}
              onChangeComplete={(color) => setStrokeColor(color.hex)}
            />
          </div>
        </div>
      </div>
    );
  })();

  const selectColorButton = () => {
    return (
      <div className="flex">
        <button
          onClick={() => setShowColorPickerModal((val) => !val)}
          type="button"
          className={`border-2 border-slate-400 rounded-lg px-4 py-2`}
          style={{ backgroundColor: strokeColor }}
        ></button>
        {colorPickerModal}
      </div>
    );
  };

  const modeName = useMemo(() => {
    switch (mode) {
      case Mode.Draw:
        return "Draw";
      case Mode.Text:
        return "Text";
      case Mode.Line:
        return "Line";
      case Mode.Image:
        return "Image";
      default:
        return ""
    }
  }, [mode])

  const editModeUtil = (() => {
    switch (mode) {
      case Mode.Draw:
      case Mode.Line:
        return (
          <div className="flex space-x-2 w-full">
            <div className="flex w-full">
              <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 rounded-l-md border border-r-0 border-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
                Stroke Width
              </span>
              <input
                type="number"
                value={strokeWidth}
                onChange={(e) =>
                  setStrokeWidth(parseFloat(e.target.value) || 1)
                }
                className="rounded-none rounded-r-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 text-sm border-gray-300 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 w-[80px]"
              />
            </div>
            {selectColorButton()}
          </div>
        );
      case Mode.Text:
        return (
          <div className="flex flex-col items-center w-full">
            <div className="flex gap-2 w-full">
              <div className="flex flex-col gap-2 w-full">
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 rounded-l-md border border-r-0 border-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
                    Font Size (px)
                  </span>
                  <input
                    type="number"
                    value={strokeWidth}
                    onChange={(e) =>
                      setStrokeWidth(parseFloat(e.target.value) || 1)
                    }
                    className="rounded-none rounded-r-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 text-sm border-gray-300 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 w-[80px]"
                  />
                </div>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 rounded-l-md border border-r-0 border-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
                    Font Fam
                  </span>
                  <select
                    value={font}
                    onChange={(e) =>
                      setFont(e.target.value as (typeof Fonts)[number])
                    }
                    className="rounded-none rounded-r-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 text-sm border-gray-300 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 w-[150px]"
                  >
                    {Fonts.map((f, i) => (
                      <option key={i} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectColorButton()}
            </div>
            <div className="w-full">
              <label
                htmlFor="message"
                className="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-400"
              >
                Your text
              </label>
              <textarea
                onChange={(e) => setText(e.target.value)}
                id="message"
                rows={4}
                className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="Your message..."
              ></textarea>
            </div>
          </div>
        );
      case Mode.Image:
        return (
          <div className="flex flex-col gap-2 w-full">
            <input
              type={"file"}
              accept=".png"
              onChange={onImageUpload}
              className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
            />
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 rounded-l-md border border-r-0 border-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
                Height
              </span>
              <input
                type="number"
                value={imageHeight}
                onChange={(e) => setImageHeight(parseFloat(e.target.value))}
                className="rounded-none rounded-r-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 text-sm border-gray-300 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 w-[80px]"
              />
            </div>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 rounded-l-md border border-r-0 border-gray-300 dark:bg-gray-600 dark:text-gray-400 dark:border-gray-600">
                Width
              </span>
              <input
                type="number"
                value={imageWidth}
                onChange={(e) => setImageWidth(parseFloat(e.target.value))}
                className="rounded-none rounded-r-lg bg-gray-50 border text-gray-900 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 text-sm border-gray-300 p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 w-[80px]"
              />
            </div>
          </div>
        );
      default:
        return;
    }
  })();

  return (
    <div className="flex justify-start items-start">
      <div className="flex flex-col w-fit space-y-4 bg-white sticky top-0 h-screen p-2">
        <div className="flex flex-col justify-center items-center gap-2">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => saveChanges()}
              type="button"
              className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
            >
              Save
            </button>
            <button
              onClick={() => undo()}
              type="button"
              className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
            >
              Undo
            </button>
            <button
              onClick={() => clearCanvas()}
              type="button"
              className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
            >
              Clear
            </button>
            <button
              onClick={() => downloadPdf()}
              type="button"
              className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
            >
              Download
            </button>
          </div>
          <input
            type={"file"}
            accept=".pdf"
            onChange={onFileUpload}
            className="block w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 cursor-pointer dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
          />
        </div>
        <div className="flex justify-center items-center space-x-4">
          <svg
            onClick={() => setMode(Mode.Draw)}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 576 512"
          >
            <path d="M224 263.3C224.2 233.3 238.4 205.2 262.4 187.2L499.1 9.605C517.7-4.353 543.6-2.965 560.7 12.9C577.7 28.76 580.8 54.54 568.2 74.07L406.5 324.1C391.3 347.7 366.6 363.2 339.3 367.1L224 263.3zM320 400C320 461.9 269.9 512 208 512H64C46.33 512 32 497.7 32 480C32 462.3 46.33 448 64 448H68.81C86.44 448 98.4 429.1 96.59 411.6C96.2 407.8 96 403.9 96 400C96 339.6 143.9 290.3 203.7 288.1L319.8 392.5C319.9 394.1 320 397.5 320 400V400z" />
          </svg>
          <svg
            onClick={() => setMode(Mode.Text)}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 384 512"
          >
            <path d="M381.5 435.7l-160-384C216.6 39.78 204.9 32.01 192 32.01S167.4 39.78 162.5 51.7l-160 384c-6.797 16.31 .9062 35.05 17.22 41.84c16.38 6.828 35.08-.9219 41.84-17.22l31.8-76.31h197.3l31.8 76.31c5.109 12.28 17.02 19.7 29.55 19.7c4.094 0 8.266-.7969 12.3-2.484C380.6 470.7 388.3 452 381.5 435.7zM119.1 320L192 147.2l72 172.8H119.1z" />
          </svg>
          <svg
            onClick={() => setMode(Mode.Line)}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 384 512"
          >
            <path d="M62.36 458.1C56.77 474.9 38.65 483.9 21.88 478.4C5.116 472.8-3.946 454.6 1.643 437.9L129.6 53.88C135.2 37.12 153.4 28.05 170.1 33.64C186.9 39.23 195.9 57.35 190.4 74.12L62.36 458.1zM261.3 32.44C278.7 35.34 290.5 51.83 287.6 69.26L223.6 453.3C220.7 470.7 204.2 482.5 186.7 479.6C169.3 476.7 157.5 460.2 160.4 442.7L224.4 58.74C227.3 41.31 243.8 29.53 261.3 32.44H261.3zM352 32C369.7 32 384 46.33 384 64V448C384 465.7 369.7 480 352 480C334.3 480 320 465.7 320 448V64C320 46.33 334.3 32 352 32V32z" />
          </svg>
          <svg
            onClick={() => setMode(Mode.Image)}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
          >
            <path d="M447.1 32h-384C28.64 32-.0091 60.65-.0091 96v320c0 35.35 28.65 64 63.1 64h384c35.35 0 64-28.65 64-64V96C511.1 60.65 483.3 32 447.1 32zM111.1 96c26.51 0 48 21.49 48 48S138.5 192 111.1 192s-48-21.49-48-48S85.48 96 111.1 96zM446.1 407.6C443.3 412.8 437.9 416 432 416H82.01c-6.021 0-11.53-3.379-14.26-8.75c-2.73-5.367-2.215-11.81 1.334-16.68l70-96C142.1 290.4 146.9 288 152 288s9.916 2.441 12.93 6.574l32.46 44.51l93.3-139.1C293.7 194.7 298.7 192 304 192s10.35 2.672 13.31 7.125l128 192C448.6 396 448.9 402.3 446.1 407.6z" />
          </svg>
        </div>
        <div className="flex justify-center items-center space-x-[50px]">
          <svg
            onClick={() => setCurrentPage((v) => (v - 1 > 0 ? v - 1 : v))}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 512"
          >
            <path d="M137.4 406.6l-128-127.1C3.125 272.4 0 264.2 0 255.1s3.125-16.38 9.375-22.63l128-127.1c9.156-9.156 22.91-11.9 34.88-6.943S192 115.1 192 128v255.1c0 12.94-7.781 24.62-19.75 29.58S146.5 415.8 137.4 406.6z" />
          </svg>
          <span>Page: {currentPage}</span>
          <svg
            onClick={() =>
              setCurrentPage((v) => (v + 1 <= totalPage ? v + 1 : v))
            }
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 512"
          >
            <path d="M118.6 105.4l128 127.1C252.9 239.6 256 247.8 256 255.1s-3.125 16.38-9.375 22.63l-128 127.1c-9.156 9.156-22.91 11.9-34.88 6.943S64 396.9 64 383.1V128c0-12.94 7.781-24.62 19.75-29.58S109.5 96.23 118.6 105.4z" />
          </svg>
        </div>
        <span className="text-center">{pdfName}</span>
        <div className="flex justify-center items-center space-x-5 text-lg">
          <button
            onClick={() => setScale((v) => v + 0.2)}
            type="button"
            className="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800"
          >
            +
          </button>
          <span>zoom</span>
          <button
            onClick={() => setScale((v) => v - 0.2)}
            type="button"
            className="focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900"
          >
            -
          </button>
        </div>
        <span className="text-center">{modeName}</span>
        <div className="flex justify-center items-center space-x-2">
          {editModeUtil}
        </div>
      </div>
      <div id="pages" className="flex flex-col space-y-8 mx-auto py-5"></div>
    </div>
  );
}

export default App;
