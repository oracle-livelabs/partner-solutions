import React, { useEffect, useRef } from "react";
import "./poi-visual-search.css";

export default function PoiVisualSearch({ user, query, setQuery, onSearchStart }) {
  const requestId = useRef(0);
  const controller = useRef(null);
  useEffect(() => () => { requestId.current++; controller.current?.abort(); }, []);

  function clear() {
    requestId.current++;
    controller.current?.abort();
    setQuery(null);
  }

  async function search(file) {
    if (!file) return;
    onSearchStart();
    const id = ++requestId.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setQuery({ filename: file.name, loading: true });
    try {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw Error("Choose a PNG, JPEG or WebP image.");
      if (!file.size || file.size > 8 * 1024 * 1024) throw Error("Choose an image between 1 byte and 8 MB.");
      const preview = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("The image could not be read."));
        reader.readAsDataURL(file);
      });
      if (id !== requestId.current) return;
      setQuery({ filename: file.name, preview, loading: true });
      const response = await fetch("/api/persons/search/visual", {
        method: "POST", signal: abort.signal,
        headers: { "Content-Type": "application/json", "X-Demo-User": user },
        body: JSON.stringify({ imageDataUrl: preview, topK: 6 }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Image search failed. Choose the image again to retry.");
      if (!Array.isArray(data.results)) throw Error("Image search returned an unexpected response.");
      if (id === requestId.current) setQuery({ filename: file.name, preview, loading: false, data });
    } catch (error) {
      if (id === requestId.current) setQuery(current => ({ ...current, loading: false, error: error.message }));
    }
  }

  return <section className="poi-visual-search" aria-labelledby="poi-visual-title">
    <div className="poi-visual-search__heading"><small>VISUAL VECTOR SEARCH</small><h3 id="poi-visual-title">Search using an uploaded image</h3><p>Choose an image to search automatically. Ranked portrait matches appear below.</p></div>
    <div className="poi-visual-search__query">
      {query?.preview ? <img className="poi-visual-search__preview" src={query.preview} alt="Uploaded search image" /> : <div className="poi-visual-search__placeholder">Your test image</div>}
      <div className="poi-visual-search__controls">
        <strong>{query?.preview ? "Uploaded search image" : "Choose a fictional test image"}</strong>
        {query && <span className="poi-visual-search__filename">{query.filename}</span>}
        <label className="poi-visual-search__choose">{query ? "Choose another image" : "Choose test image"}<input type="file" aria-label="Choose test image" accept="image/png,image/jpeg,image/webp" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; search(file); }} /></label>
        <small>PNG, JPEG or WebP · up to 8 MB</small>
        {query && <button type="button" className="poi-visual-search__clear" onClick={clear}>Clear image search</button>}
      </div>
    </div>
    <div role="status" aria-live="polite">{query?.loading && <p>Searching for similar portraits…</p>}{query?.data && <p>{query.data.results.length} ranked results for {query.filename}</p>}</div>
    {query?.error && <p className="pattern-error" role="alert">{query.error}</p>}
  </section>;
}

export function PoiVectorResults({ data, mode, onViewProfile }) {
  return <div className="poi-visual-search__results">
      <p className="poi-visual-search__note">{mode === 'visual' ? 'Scores measure CLIP visual similarity, not identity confidence.' : 'Scores measure semantic similarity to your narrative query.'} Results are ranked highest first.</p>
      {!data.results.length ? <p>No comparable profiles are available for this user.</p> : <div className="poi-visual-search__cards">
        {data.results.map((person, index) => <article className="poi-visual-match" key={person.PERSON_REF}>
          <span className="poi-visual-match__rank">#{index + 1}</span>
          <img src={person.PORTRAIT_ASSET_URI} alt={`Reference portrait: ${person.DISPLAY_NAME || person.ALIAS_NAME}`} />
          <div className="poi-visual-match__body"><h5>{person.DISPLAY_NAME || person.ALIAS_NAME}</h5><small>{person.PERSON_REF}</small><strong className="poi-visual-match__score">{Number(person.SIMILARITY_SCORE).toFixed(4)} <span>{mode} similarity</span></strong>{mode === 'narrative' && <p>{person.NARRATIVE_SUMMARY}</p>}<button type="button" onClick={() => onViewProfile(person.PERSON_REF)}>View profile</button></div>
        </article>)}
      </div>}
    </div>;
}
