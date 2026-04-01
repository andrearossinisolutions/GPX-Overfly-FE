export default function GpxUploader({ onLoaded }) {
  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    onLoaded(text, file.name)
  }

  return (
    <div>
      <input type="file" accept=".gpx" onChange={handleFile} />
    </div>
  )
}