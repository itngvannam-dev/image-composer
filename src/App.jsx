import { useMemo, useState } from "react";
import { saveAs } from "file-saver";
import { composeVerticalImages } from "./utils/composeImages";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";

import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";

import CloseIcon from "@mui/icons-material/Close";

const MODE = {
  NORMAL: "normal",
  FACTORIAL: "factorial",
};

function SortableImageCard({ item, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  });

  const style = {
    transform: transform
      ? CSS.Transform.toString(transform)
      : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="image-card"
      {...attributes}
      {...listeners}
    >
      <img src={item.preview} alt="" />

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
      >
        Xoá
      </button>
    </div>
  );
}

function DragOverlayImageCard({ item }) {
  if (!item) return null;

  return (
    <div className="image-card dragging-overlay">
      <img src={item.preview} alt="" />
    </div>
  );
}

export default function App() {
  const [selectedMode, setSelectedMode] = useState(null);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const [previewItems, setPreviewItems] = useState([]);
  const [previewDialogOpen, setPreviewDialogOpen] =
    useState(false);

  const [selectedPreviewIndexes, setSelectedPreviewIndexes] =
    useState([]);

  const [activeId, setActiveId] = useState(null);

  const [progress, setProgress] = useState(0);

  const [mode, setMode] = useState(MODE.NORMAL);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDrop = (acceptedFiles) => {
    const mapped = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setFiles((prev) => [...prev, ...mapped]);
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "image/*": [],
    },
    onDrop,
  });

  const removeImage = (id) => {
    setFiles((prev) =>
      prev.filter((item) => item.id !== id)
    );
  };

  const resetAll = () => {
    files.forEach((item) => {
      URL.revokeObjectURL(item.preview);
    });

    previewItems.forEach((item) => {
      URL.revokeObjectURL(item.url);
    });

    setFiles([]);
    setPreviewItems([]);
    setSelectedPreviewIndexes([]);
    setPreviewDialogOpen(false);
    setProgress(0);
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over || active.id === over.id) return;

    setFiles((items) => {
      const oldIndex = items.findIndex(
        (item) => item.id === active.id
      );

      const newIndex = items.findIndex(
        (item) => item.id === over.id
      );

      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const activeItem = useMemo(
    () =>
      files.find((item) => item.id === activeId),
    [activeId, files]
  );

  const buildPairs = () => {
    const pairs = [];

    // NORMAL
    if (selectedMode === "normal") {
      for (
        let i = 0;
        i < files.length;
        i += 2
      ) {
        const first = files[i];
        const second = files[i + 1];

        if (!first || !second)
          continue;

        pairs.push([first, second]);
      }
    }

    // FACTORIAL
    if (selectedMode === "factorial") {
      for (
        let i = 0;
        i < files.length;
        i++
      ) {
        for (
          let j = i + 1;
          j < files.length;
          j++
        ) {
          pairs.push([
            files[i],
            files[j],
          ]);
        }
      }
    }

    return pairs;
  };

  const totalPairs = buildPairs().length;

  const generatePreview = async () => {
    if (files.length < 2) {
      alert("Please import at least 2 images.");
      return;
    }

    setLoading(true);

    try {
      const pairs = buildPairs();

      const items = [];

      for (let i = 0; i < pairs.length; i++) {
        const [first, second] = pairs[i];

        const blob = await composeVerticalImages(
          first.file,
          second.file
        );

        items.push({
          blob,
          url: URL.createObjectURL(blob),
          name: `preview_${i + 1}.jpg`,
        });
      }

      setPreviewItems(items);
      setSelectedPreviewIndexes([]);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error(error);

      alert(
        "Error generating preview: " +
        (error?.message || "Unknown")
      );
    } finally {
      setLoading(false);
    }
  };

  const generateImages = async () => {
    if (files.length < 2) {
      alert("Please import at least 2 images.");
      return;
    }

    setLoading(true);
    setProgress(0);

    try {
      const zip = new JSZip();

      const pairs = buildPairs();

      for (let i = 0; i < pairs.length; i++) {
        const [first, second] = pairs[i];

        const blob = await composeVerticalImages(
          first.file,
          second.file
        );

        zip.file(`result_${i + 1}.jpg`, blob);

        setProgress(
          Math.round(((i + 1) / pairs.length) * 100)
        );
      }

      const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
      });

      saveAs(content, "images.zip");
    } catch (error) {
      console.error(error);

      alert(
        "Error exporting ZIP: " +
        (error?.message || "Unknown")
      );
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);

    a.click();

    a.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  };

  // const generateImages = async () => {
  //   if (files.length < 2) {
  //     alert("Please import at least 2 images.");
  //     return;
  //   }

  //   setLoading(true);
  //   setProgress(0);

  //   try {
  //     const pairs = buildPairs();

  //     for (let i = 0; i < pairs.length; i++) {
  //       const [first, second] = pairs[i];

  //       const blob = await composeVerticalImages(
  //         first.file,
  //         second.file
  //       );

  //       downloadBlob(
  //         blob,
  //         `result_${i + 1}.jpg`
  //       );

  //       setProgress(
  //         Math.round(
  //           ((i + 1) / pairs.length) * 100
  //         )
  //       );

  //       // delay nhẹ tránh browser block download
  //       await new Promise((resolve) =>
  //         setTimeout(resolve, 150)
  //       );
  //     }
  //   } catch (error) {
  //     console.error(error);

  //     alert(
  //       "Error exporting images: " +
  //       (error?.message || "Unknown")
  //     );
  //   } finally {
  //     setLoading(false);
  //     setProgress(0);
  //   }
  // };

  const togglePreviewSelection = (index) => {
    setSelectedPreviewIndexes((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const closePreviewDialog = () => {
    setPreviewDialogOpen(false);
    setSelectedPreviewIndexes([]);
  };

  const downloadPreviewSelection = async () => {
    if (previewItems.length === 0) return;

    const indexes =
      selectedPreviewIndexes.length > 0
        ? selectedPreviewIndexes
        : previewItems.map((_, index) => index);

    const zip = new JSZip();

    indexes.forEach((index) => {
      const item = previewItems[index];

      zip.file(item.name, item.blob);
    });

    const content = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
    });

    saveAs(content, "preview.zip");

    setSelectedPreviewIndexes([]);
    setPreviewDialogOpen(false);
  };

  // const downloadPreviewSelection = async () => {
  //   if (previewItems.length === 0) return;

  //   const indexes =
  //     selectedPreviewIndexes.length > 0
  //       ? selectedPreviewIndexes
  //       : previewItems.map(
  //         (_, index) => index
  //       );

  //   for (let i = 0; i < indexes.length; i++) {
  //     const index = indexes[i];

  //     const item = previewItems[index];

  //     downloadBlob(item.blob, item.name);

  //     await new Promise((resolve) =>
  //       setTimeout(resolve, 150)
  //     );
  //   }

  //   setSelectedPreviewIndexes([]);
  //   setPreviewDialogOpen(false);
  // };

  return (
    <div className="app">
      {!selectedMode ? (
        <div className="landing-page">
          <div className="landing-hero">
            <h1>Image Composer</h1>

            <p>
              Chọn chế độ tạo ảnh và import ít nhất 2 ảnh để bắt đầu
            </p>
          </div>

          <div className="landing-grid">
            <button
              className="landing-card"
              onClick={() =>
                setSelectedMode("normal")
              }
            >
              <Stack spacing={1} sx={{alignItems: "baseline"}} justifyContent="left" alignItems="baseline" direction="column">
                <h2>Ghép thường</h2>

                <p>
                  Tạo hình ảnh tuần tự
                </p>

                <small>
                  10 ảnh → 5 ảnh ghép
                </small>
              </Stack>

              <span>→</span>
            </button>

            <button
              className="landing-card"
              onClick={() =>
                setSelectedMode("factorial")
              }
            >
              <Stack spacing={1} sx={{alignItems: "baseline"}} justifyContent="left" alignItems="baseline" direction="column">
                <h2>Ghép ngẫu nhiên</h2>
                <p>
                  Tạo tất cả các tổ hợp có thể của ảnh
                </p>
                <small>
                  10 ảnh → 45 ảnh ghép
                </small>
              </Stack>

              <span>→</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <header className="app-header">
            <div>
              <button
                className="back-btn"
                onClick={() =>
                  setSelectedMode(null)
                }
              >
                ← Quay lại
              </button>

              <h1>Image Composer</h1>

              <p className="summary">
                {files.length} ảnh
              </p>
            </div>

            <div className="header-actions">
              <button
                className="header-btn"
                onClick={generatePreview}
                disabled={
                  loading ||
                  files.length < 2
                }
              >
                Xem trước
              </button>

              <button
                className="header-btn"
                onClick={generateImages}
                disabled={
                  loading ||
                  files.length < 2
                }
              >
                {loading
                  ? `Tải xuống ${progress}%`
                  : "Tải xuống tất cả ảnh"}
              </button>

              <button
                className="header-btn reset"
                onClick={resetAll}
                disabled={
                  loading ||
                  files.length === 0
                }
              >
                Làm mới
              </button>
            </div>
          </header>

          <div
            {...getRootProps()}
            className="dropzone"
          >
            <input {...getInputProps()} />

            <p>
              Kéo và thả ảnh vào đây
            </p>

            <small>
              Chế độ hiện tại:{" "}
              {selectedMode === MODE.NORMAL ? "Ghép thường" : "Ghép ngẫu nhiên"}
            </small>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={
              closestCenter
            }
            onDragStart={
              handleDragStart
            }
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={files.map(
                (item) => item.id
              )}
              strategy={
                rectSortingStrategy
              }
            >
              <div className="image-grid">
                {files.map((item) => (
                  <SortableImageCard
                    key={item.id}
                    item={item}
                    onRemove={
                      removeImage
                    }
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              <DragOverlayImageCard
                item={activeItem}
              />
            </DragOverlay>
          </DndContext>

          <Dialog
            open={previewDialogOpen}
            onClose={
              closePreviewDialog
            }
            fullWidth
            maxWidth="lg"
          >
            <DialogTitle
              sx={{
                position: "relative",
                pr: 6,
              }}
            >
              Xem trước

              <IconButton
                aria-label="close"
                onClick={
                  closePreviewDialog
                }
                sx={{
                  position:
                    "absolute",
                  right: 8,
                  top: 8,
                  color: "grey.500",
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent
              dividers
              sx={{
                p: 2,
                backgroundColor:
                  "#111",
              }}
            >
              <Stack
                spacing={2}
                direction="row"
                useFlexGap
                sx={{
                  flexWrap: "wrap",
                }}
              >
                {previewItems.map(
                  (item, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`preview-dialog-thumb ${selectedPreviewIndexes.includes(
                        index
                      )
                        ? "selected"
                        : ""
                        }`}
                      onClick={() =>
                        togglePreviewSelection(
                          index
                        )
                      }
                    >
                      <img
                        src={item.url}
                        alt={`preview ${index + 1
                          }`}
                      />
                    </button>
                  )
                )}
              </Stack>
            </DialogContent>

            <DialogActions
              sx={{
                justifyContent:
                  "flex-end",
              }}
            >
              <button
                className="header-btn"
                type="button"
                onClick={
                  downloadPreviewSelection
                }
              >
                {selectedPreviewIndexes.length >
                  0
                  ? `Tải xuống ${selectedPreviewIndexes.length} ảnh đã chọn`
                  : "Tải xuống tất cả ảnh"}
              </button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </div>
  );
}