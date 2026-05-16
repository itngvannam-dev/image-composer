import { useState } from "react";
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
import { Stack } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
function SortableImageCard({ item, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`image-card ${isDragging ? "dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <img src={URL.createObjectURL(item.file)} alt="" />
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(item.id);
        }}
      >
        Remove
      </button>
    </div>
  );
}

function DragOverlayImageCard({ item }) {
  if (!item) return null;

  return (
    <div className="image-card dragging-overlay">
      <img src={URL.createObjectURL(item.file)} alt="" />
    </div>
  );
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedPreviewIndexes, setSelectedPreviewIndexes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [progress, setProgress] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { distance: 8 }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDrop = (acceptedFiles) => {
    setFiles((prev) => [
      ...prev,
      ...acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
      })),
    ]);
  };

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "image/*": [] },
    onDrop,
  });

  const removeImage = (id) => {
    setFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const resetAll = () => {
    setFiles([]);
    setPreviewItems([]);
    setPreviewDialogOpen(false);
    setSelectedPreviewIndexes([]);
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
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const closePreviewDialog = () => {
    setPreviewDialogOpen(false);
    setSelectedPreviewIndexes([]);
  };

  const togglePreviewSelection = (index) => {
    setSelectedPreviewIndexes((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  const generatePreview = async () => {
    if (files.length < 2) {
      alert("Please import at least 2 images.");
      return;
    }

    setLoading(true);

    try {
      const items = [];
      const totalPairs = Math.floor(files.length / 2);

      for (let i = 0; i < totalPairs; i += 1) {
        const first = files[i * 2]?.file;
        const second = files[i * 2 + 1]?.file;
        if (!first || !second) continue;

        const blob = await composeVerticalImages(first, second);
        items.push({
          url: URL.createObjectURL(blob),
          blob,
          name: `preview_${i + 1}.jpg`,
        });
      }

      if (items.length === 0) {
        throw new Error("No preview could be generated.");
      }

      setPreviewItems(items);
      setSelectedPreviewIndexes([]);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error("Preview generate error", error);
      alert("Error generating preview: " + (error?.message || "Unknown"));
    } finally {
      setLoading(false);
    }
  };

  const downloadPreviewSelection = async () => {
    if (previewItems.length === 0) return;

    const selectedIndexes =
      selectedPreviewIndexes.length > 0
        ? selectedPreviewIndexes
        : previewItems.map((_, index) => index);

    const zip = new JSZip();
    selectedIndexes.forEach((index) => {
      const item = previewItems[index];
      zip.file(item.name, item.blob);
    });

    const content = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
    });

    saveAs(
      content,
      selectedIndexes.length === previewItems.length
        ? "preview-all.zip"
        : "preview-selected.zip"
    );
    setSelectedPreviewIndexes([]);
    setPreviewDialogOpen(false);
  };

  const generateImages = async () => {
    if (files.length < 2) {
      alert("Please import at least 2 images.");
      return;
    }

    setLoading(true);
    setProgress(0);

    const zip = new JSZip();
    const totalPairs = Math.floor(files.length / 2);

    try {
      for (let i = 0; i < totalPairs; i += 1) {
        const blob = await composeVerticalImages(
          files[i * 2].file,
          files[i * 2 + 1].file
        );
        zip.file(`result_${i + 1}.jpg`, blob);
        setProgress(Math.round(((i + 1) / totalPairs) * 100));
      }

      const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
      });
      saveAs(content, "images.zip");
    } catch (error) {
      console.error("Export error", error);
      alert("Error exporting ZIP: " + (error?.message || "Unknown"));
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const activeItem = files.find((item) => item.id === activeId);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Image Composer</h1>
          <p className="summary">
            {files.length} image(s) · {Math.floor(files.length / 2)} pair(s)
          </p>
        </div>

        <div className="header-actions">
          <button
            className="header-btn"
            onClick={generatePreview}
            disabled={loading || files.length < 2}
          >
            Preview
          </button>
          <button
            className="header-btn"
            onClick={generateImages}
            disabled={loading || files.length < 2}
          >
            {loading ? `Exporting ${progress}%` : "Export ZIP"}
          </button>
          <button
            className="header-btn reset"
            onClick={resetAll}
            disabled={loading || files.length === 0}
          >
            Reset
          </button>
        </div>
      </header>

      <div {...getRootProps()} className="dropzone">
        <input {...getInputProps()} />
        <p>Drag & Drop Images Here</p>
        <small>Chọn ảnh để drop vào đây</small>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={files.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          <div className="image-grid">
            {files.map((item) => (
              <SortableImageCard
                key={item.id}
                item={item}
                onRemove={removeImage}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          <DragOverlayImageCard item={activeItem} />
        </DragOverlay>
      </DndContext>

      <Dialog
        open={previewDialogOpen}
        onClose={closePreviewDialog}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ position: "relative", pr: 6 }}>
          Preview
          <IconButton
            aria-label="close"
            onClick={closePreviewDialog}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: "grey.500",
            }}
          >
            <CloseIcon/>
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2, backgroundColor: "#111" }}>
          <div className="preview-dialog-grid">
            <Stack spacing={2} direction="row" useFlexGap
              sx={{ flexWrap: 'wrap' }} justifyContent="start">
              {previewItems.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  className={`preview-dialog-thumb ${selectedPreviewIndexes.includes(index) ? "selected" : ""
                    }`}
                  onClick={() => togglePreviewSelection(index)}
                >
                  <img src={item.url} alt={`preview ${index + 1}`} />
                </button>
              ))}

            </Stack>

          </div>
        </DialogContent>

        <DialogActions sx={{ justifyContent: "flex-end", }}>
          <button className="header-btn" type="button" onClick={downloadPreviewSelection}>
            {selectedPreviewIndexes.length > 0
              ? `Download ${selectedPreviewIndexes.length} selected`
              : "Download all"}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}