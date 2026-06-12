import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { STAGES } from '../lib/stages'

export default function ProgrammePage() {
  const { orgId, progId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [prog, setProg] = useState(null)
  const [orgName, setOrgName] = useState('')
  const [tab, setTab] = useState('journey')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingStage, setAddingStage] = useState(null)
  const [addText, setAddText] = useState('')
  const addInputRef = useRef()
  const progLogoRef = useRef()

  const isSU = profile?.role === 'superuser'
  const isManager = isSU || profile?.role === 'manager'

  useEffect(() => { fetchProg() }, [progId])
  useEffect(() => { if (addingStage && addInputRef.current) addInputRef.current.focus() }, [addingStage])

  async function fetchProg() {
    setLoading(true)
    const [{ data: p }, { data: o }] = await Promise.all([
      supabase.from('programmes').select('*').eq('id', progId).single(),
      supabase.from('organisations').select('name').eq('id', orgId).single(),
    ])
    setProg(p)
    setOrgName(o?.name || '')
    setLoading(false)
  }

  async function saveJourney(updatedJourney) {
    setSaving(true)
    await supabase.from('programmes').update({ journey: updatedJourney }).eq('id', progId)
    setSaving(false)
  }

  function addItem() {
    if (!addText.trim() || !addingStage) return
    const updated = { ...(prog.journey || {}) }
    if (!updated[addingStage]) updated[addingStage] = []
    updated[addingStage] = [...updated[addingStage], addText.trim()]
    setProg(p => ({ ...p, journey: updated }))
    saveJourney(updated)
    setAddText('')
    setAddingStage(null)
  }

  function removeItem(stageId, idx) {
    const updated = { ...(prog.journey || {}) }
    updated[stageId] = updated[stageId].filter((_, i) => i !== idx)
    setProg(p => ({ ...p, journey: updated }))
    saveJourney(updated)
  }

  async function updateResponsible(stageId, item, value) {
    const { data: existing } = await supabase.from('data_collection')
      .select('id').eq('programme_id', progId).eq('stage_id', stageId).eq('item', item).maybeSingle()
    if (existing) {
      await supabase.from('data_collection').update({ responsible: value }).eq('id', existing.id)
    } else {
      await supabase.from('data_collection').insert({ programme_id: progId, stage_id: stageId, item, responsible: value })
    }
  }

  async function uploadFile(stageId, item, file) {
    const { data: existing } = await supabase.from('data_collection')
      .select('id, files').eq('programme_id', progId).eq('stage_id', stageId).eq('item', item).maybeSingle()
    const path = `dc-files/${progId}/${stageId}/${Date.now()}_${file.name}`
    await supabase.storage.from('assets').upload(path, file, { upsert: true })
    const { data: pub } = supabase.storage.from('assets').getPublicUrl(path)
    const fileEntry = { name: file.name, url: pub.publicUrl, path }
    if (existing) {
      const files = [...(existing.files || []), fileEntry]
      await supabase.from('data_collection').update({ files }).eq('id', existing.id)
    } else {
      await supabase.from('data_collection').insert({ programme_id: progId, stage_id: stageId, item, files: [fileEntry] })
    }
    fetchDC()
  }

  async function removeFile(dcId, fileIdx, filePath, currentFiles) {
    await supabase.storage.from('assets').remove([filePath])
    const files = currentFiles.filter((_, i) => i !== fileIdx)
    await supabase.from('data_collection').update({ files }).eq('id', dcId)
    fetchDC()
  }

  const [dcRows, setDcRows] = useState([])
  useEffect(() => { if (tab === 'collection') fetchDC() }, [tab, progId])

  async function fetchDC() {
    const { data } = await supabase.from('data_collection')
      .select('*').eq('programme_id', progId)
    setDcRows(data || [])
  }

  function getDC(stageId, item) {
    return dcRows.find(r => r.stage_id === stageId && r.item === item) || { responsible: '', files: [] }
  }

  async function uploadProgLogo(file) {
    const ext = file.name.split('.').pop()
    const path = `prog-logos/${progId}.${ext}`
    await supabase.storage.from('assets').upload(path, file, { upsert: true })
    const { data } = supabase.storage.from('assets').getPublicUrl(path)
    await supabase.from('programmes').update({ logo_url: data.publicUrl }).eq('id', progId)
    fetchProg()
  }

  const allItems = STAGES.flatMap(st =>
    ((prog?.journey || {})[st.id] || []).map(item => ({ stage: st, item }))
  )

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>
  if (!prog) return <div className="empty-state"><p>Programme not found.</p></div>

  const ini = prog.name.slice(0, 2).toUpperCase()

  return (
    <>
      <button className="nav-back" onClick={() => navigate(`/orgs/${orgId}`)}>← {orgName}</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="logo-upload-wrap" style={{ width: 50, height: 50 }} onClick={() => isManager && progLogoRef.current?.click()}>
          {prog.logo_url ? <img src={prog.logo_url} alt={prog.name} /> : <span style={{ fontSize: 15, fontWeight: 700, color: '#9ca3af' }}>{ini}</span>}
          {isManager && <input type="file" ref={progLogoRef} accept="image/*" style={{ display: 'none' }} onChange={e => uploadProgLogo(e.target.files[0])} />}
        </div>
        <div>
          <div className="page-title" style={{ fontSize: 18 }}>{prog.name}</div>
          <div className="page-sub">{orgName}</div>
        </div>
        {saving && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>Saving…</span>}
      </div>

      <div className="tabs">
        <button className={`tab${tab === 'journey' ? ' active' : ''}`} onClick={() => setTab('journey')}>Participant Journey</button>
        <button className={`tab${tab === 'collection' ? ' active' : ''}`} onClick={() => setTab('collection')}>Data Collection</button>
      </div>

      {tab === 'journey' && (
        <>
          <div className="info-bar">ℹ️ Add items under each stage. They'll appear in Data Collection for assigning responsibility and uploading forms.</div>
          <div className="stages-grid">
            {STAGES.map(st => {
              const items = (prog.journey || {})[st.id] || []
              return (
                <div key={st.id} className="stage-col">
                  <div className="stage-head" style={{ background: st.headBg }}>
                    <img className="stage-icon" src={st.icon} alt={st.short} />
                    <div className="stage-num">{st.label}</div>
                    <div className="stage-desc" dangerouslySetInnerHTML={{ __html: st.desc }} />
                  </div>
                  <div className="stage-body">
                    {items.map((item, idx) => (
                      <div key={idx} className="stage-item">
                        <span>{item}</span>
                        {isManager && <button className="stage-item-del" onClick={() => removeItem(st.id, idx)}>×</button>}
                      </div>
                    ))}
                    {isManager && (
                      addingStage === st.id ? (
                        <div className="add-row">
                          <input ref={addInputRef} value={addText} onChange={e => setAddText(e.target.value)}
                            placeholder="Add item…"
                            onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setAddingStage(null) }} />
                          <button className="btn btn-sm btn-primary" onClick={addItem}>+</button>
                          <button className="btn btn-sm" onClick={() => setAddingStage(null)}>×</button>
                        </div>
                      ) : (
                        <button className="add-item-btn" onClick={() => { setAddingStage(st.id); setAddText('') }}>+ add item</button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'collection' && (
        <>
          <div className="info-bar">ℹ️ Assign responsibility and upload forms for each journey item. Colleagues see all uploaded files here.</div>
          {allItems.length === 0 ? (
            <div className="empty-state"><p>Add items in the Participant Journey tab first.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th style={{ width: 90 }}>Stage</th>
                  <th>Item</th>
                  <th style={{ width: 160 }}>Responsible</th>
                  <th style={{ width: 220 }}>Files / Forms</th>
                </tr></thead>
                <tbody>
                  {allItems.map(({ stage, item }, ri) => {
                    const dc = getDC(stage.id, item)
                    return (
                      <tr key={`${stage.id}-${ri}`}>
                        <td><span className="stage-pill" style={{ background: stage.pillBg, color: stage.pillTx }}>{stage.short}</span></td>
                        <td style={{ fontSize: 13 }}>{item}</td>
                        <td>
                          {isManager
                            ? <input className="responsible-input" defaultValue={dc.responsible} placeholder="Who is responsible?"
                                onBlur={e => updateResponsible(stage.id, item, e.target.value)} />
                            : <span style={{ fontSize: 12, color: dc.responsible ? '#1a202c' : '#9ca3af' }}>{dc.responsible || '—'}</span>
                          }
                        </td>
                        <td>
                          <div className="file-chips">
                            {(dc.files || []).map((f, fi) => (
                              <span key={fi} className="file-chip">
                                📄 <a href={f.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{f.name}</a>
                                {isManager && dc.id && (
                                  <button className="file-chip-del" onClick={() => removeFile(dc.id, fi, f.path, dc.files)}>×</button>
                                )}
                              </span>
                            ))}
                          </div>
                          {isManager && (
                            <label className="upload-label">
                              ↑ Add file
                              <input type="file" multiple style={{ display: 'none' }}
                                onChange={e => Array.from(e.target.files).forEach(f => uploadFile(stage.id, item, f))} />
                            </label>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}
