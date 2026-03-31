'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapPin, Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

type ProjectSite = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  status: string;
  createdAt: string;
};

type FormData = {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  radius: string;
};

const EMPTY_FORM: FormData = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  radius: '500',
};

function SiteModal({
  editingId,
  form,
  setForm,
  saving,
  onSave,
  onClose,
}: {
  editingId: string | null;
  form: FormData;
  setForm: (f: FormData) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);

  const updateMarker = useCallback(
    (lat: number, lng: number) => {
      const map = mapInstanceRef.current;
      const L = leafletRef.current;
      if (!map || !L) return;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(map);
      }
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    },
    []
  );

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');

      // Fix default marker icon paths
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (cancelled || !mapRef.current) return;
      leafletRef.current = L;

      const initLat = parseFloat(formRef.current.latitude) || 23.13;
      const initLng = parseFloat(formRef.current.longitude) || 113.26;
      const initZoom = formRef.current.latitude && formRef.current.longitude ? 15 : 5;

      const map = L.map(mapRef.current).setView([initLat, initLng], initZoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      if (formRef.current.latitude && formRef.current.longitude) {
        markerRef.current = L.marker([initLat, initLng]).addTo(map);
      }

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng]).addTo(map);
        }
        setForm({
          ...formRef.current,
          latitude: lat.toFixed(6),
          longitude: lng.toFixed(6),
        });
        // Reverse geocode to fill address
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=zh`
        )
          .then((r) => r.json())
          .then((data) => {
            if (data.display_name) {
              setForm({ ...formRef.current, address: data.display_name });
            }
          })
          .catch(() => {});
      });

      mapInstanceRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          searchQuery
        )}&format=json&limit=5&accept-language=zh`
      );
      const data = await res.json();
      setSearchResults(data);
      if (data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        setForm({ ...form, latitude: lat.toFixed(6), longitude: lng.toFixed(6), address: first.display_name });
        updateMarker(lat, lng);
      }
    } catch {
      console.error('搜索失败');
    } finally {
      setSearching(false);
    }
  }

  function selectResult(result: { display_name: string; lat: string; lon: string }) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setForm({ ...form, latitude: lat.toFixed(6), longitude: lng.toFixed(6), address: result.display_name });
    updateMarker(lat, lng);
    setSearchResults([]);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">
            {editingId ? '编辑工地' : '添加工地'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* 地图搜索 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              搜索位置
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-3 py-2 pl-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入地址搜索，如：广州市天河区..."
                />
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-50 shrink-0"
              >
                {searching ? '搜索中...' : '搜索'}
              </button>
            </div>
            {/* 搜索结果列表 */}
            {searchResults.length > 1 && (
              <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => selectResult(r)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition"
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 地图 */}
          <div
            ref={mapRef}
            className="w-full h-64 rounded-lg border border-gray-200 z-0"
          />
          <p className="text-xs text-gray-400 -mt-2">
            点击地图可直接选取坐标，也可搜索地址后自动定位
          </p>

          {/* 表单 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              工地名称 *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="如：碧桂园中央半岛3期"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              地址
            </label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="搜索或点击地图后自动填入"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                纬度 *
              </label>
              <input
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                placeholder="点击地图选取"
                type="number"
                step="any"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                经度 *
              </label>
              <input
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                placeholder="点击地图选取"
                type="number"
                step="any"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              围栏半径（米）
            </label>
            <input
              value={form.radius}
              onChange={(e) => setForm({ ...form, radius: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="默认 500"
              type="number"
            />
            <p className="text-xs text-gray-400 mt-1">
              工人在此半径内才能打卡和使用关联闪卡，建议 300-1000 米
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition"
          >
            取消
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectSitesPage() {
  const [sites, setSites] = useState<ProjectSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function loadSites() {
    try {
      const res = await fetch('/api/project-sites');
      const data = await res.json();
      setSites(data.sites ?? []);
    } catch {
      console.error('加载工地列表失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSites();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(site: ProjectSite) {
    setEditingId(site.id);
    setForm({
      name: site.name,
      address: site.address,
      latitude: String(site.latitude),
      longitude: String(site.longitude),
      radius: String(site.radius),
    });
    setShowModal(true);
  }

  async function handleSave() {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const radius = parseInt(form.radius) || 500;

    if (!form.name.trim()) {
      alert('请输入工地名称');
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      alert('请输入有效的经纬度数值');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await fetch(`/api/project-sites/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            address: form.address.trim(),
            latitude: lat,
            longitude: lng,
            radius,
          }),
        });
      } else {
        await fetch('/api/project-sites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            address: form.address.trim(),
            latitude: lat,
            longitude: lng,
            radius,
          }),
        });
      }
      setShowModal(false);
      setLoading(true);
      loadSites();
    } catch {
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(site: ProjectSite) {
    if (!confirm(`确认停用工地「${site.name}」？`)) return;
    try {
      await fetch(`/api/project-sites/${site.id}`, { method: 'DELETE' });
      setLoading(true);
      loadSites();
    } catch {
      alert('操作失败，请重试');
    }
  }

  return (
    <div>
      {/* 标题 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MapPin size={22} className="text-gray-400" />
          <h1 className="text-xl font-bold text-gray-800">工地管理</h1>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          添加工地
        </button>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <MapPin size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">暂无工地</p>
          <p className="text-sm mt-1">点击"添加工地"创建第一个项目现场</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-white rounded-xl p-5 border border-gray-100 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-800">{site.name}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      site.status === 'active'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {site.status === 'active' ? '使用中' : '已停用'}
                  </span>
                </div>
                {site.address && (
                  <p className="text-sm text-gray-500 mb-1">{site.address}</p>
                )}
                <p className="text-xs text-gray-400">
                  坐标 {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)} · 围栏半径{' '}
                  {site.radius}m · 创建于 {site.createdAt}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(site)}
                  className="p-2 text-gray-400 hover:text-blue-600 transition"
                  title="编辑"
                >
                  <Pencil size={15} />
                </button>
                {site.status === 'active' && (
                  <button
                    onClick={() => handleDelete(site)}
                    className="p-2 text-gray-400 hover:text-red-500 transition"
                    title="停用"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <SiteModal
          editingId={editingId}
          form={form}
          setForm={setForm}
          saving={saving}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
