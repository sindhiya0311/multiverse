import { useEffect, useState } from 'react';
import api from '../services/api';
import { LiveMap } from '../components';
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Home,
  Briefcase,
  Users,
  Heart,
  Dumbbell,
  GraduationCap,
  Building2,
  Loader2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const iconMap = {
  home: Home,
  office: Briefcase,
  friend: Users,
  family: Heart,
  gym: Dumbbell,
  school: GraduationCap,
  hospital: Building2,
  custom: MapPin,
};

const TaggedLocations = () => {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [formData, setFormData] = useState({
    label: '',
    type: 'custom',
    latitude: '',
    longitude: '',
    radius: 100,
    address: '',
    color: '#3B82F6',
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/tagged-locations');
      setLocations(response.data.data.locations);
    } catch (error) {
      toast.error('Failed to fetch locations');
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.label || !formData.latitude || !formData.longitude) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingLocation) {
        await api.patch(`/tagged-locations/${editingLocation._id}`, formData);
        toast.success('Location updated');
      } else {
        await api.post('/tagged-locations', formData);
        toast.success('Location added');
      }
      fetchLocations();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save location');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    try {
      await api.delete(`/tagged-locations/${id}`);
      toast.success('Location deleted');
      setLocations(locations.filter((l) => l._id !== id));
    } catch (error) {
      toast.error('Failed to delete location');
    }
  };

  const openEditModal = (location) => {
    setEditingLocation(location);
    setFormData({
      label: location.label,
      type: location.type,
      latitude: location.latitude,
      longitude: location.longitude,
      radius: location.radius,
      address: location.address || '',
      color: location.color || '#3B82F6',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLocation(null);
    setFormData({
      label: '',
      type: 'custom',
      latitude: '',
      longitude: '',
      radius: 100,
      address: '',
      color: '#3B82F6',
    });
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
          }));
        },
        () => toast.error('Failed to get current location')
      );
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">
              Tagged Locations
            </h1>
            <p className="text-night-400 mt-1">
              Mark your frequently visited safe zones
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <h2 className="text-lg font-semibold text-white mb-4">Map View</h2>
            <div className="h-[400px] lg:h-[500px] rounded-xl overflow-hidden">
              <LiveMap
                taggedLocations={locations}
                zoom={12}
                center={
                  locations.length > 0
                    ? [locations[0].latitude, locations[0].longitude]
                    : undefined
                }
              />
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">
              Your Locations ({locations.length})
            </h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-noctis-400" />
              </div>
            ) : locations.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 text-night-600 mx-auto mb-4" />
                <p className="text-night-400">No locations added</p>
                <p className="text-night-500 text-sm mt-1">
                  Add your home, office, or other places
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {locations.map((location) => {
                  const Icon = iconMap[location.type] || MapPin;
                  return (
                    <div
                      key={location._id}
                      className="p-3 bg-night-800/50 rounded-lg border border-night-700 hover:border-night-600 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${location.color}20` }}
                        >
                          <Icon
                            className="w-5 h-5"
                            style={{ color: location.color }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">
                            {location.label}
                          </p>
                          <p className="text-xs text-night-400 capitalize">
                            {location.type} • {location.radius}m radius
                          </p>
                          {location.address && (
                            <p className="text-xs text-night-500 truncate mt-1">
                              {location.address}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(location)}
                            className="p-1.5 text-night-400 hover:text-white hover:bg-night-700 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(location._id)}
                            className="p-1.5 text-night-400 hover:text-red-400 hover:bg-night-700 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">
                  {editingLocation ? 'Edit Location' : 'Add Location'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 text-night-400 hover:text-white hover:bg-night-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-night-300 mb-2">
                    Label *
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, label: e.target.value }))
                    }
                    className="input"
                    placeholder="Home, Office, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-night-300 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, type: e.target.value }))
                    }
                    className="input"
                  >
                    <option value="home">Home</option>
                    <option value="office">Office</option>
                    <option value="friend">Friend's House</option>
                    <option value="family">Family's House</option>
                    <option value="gym">Gym</option>
                    <option value="school">School</option>
                    <option value="hospital">Hospital</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-night-300 mb-2">
                      Latitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          latitude: e.target.value,
                        }))
                      }
                      className="input"
                      placeholder="40.7128"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-night-300 mb-2">
                      Longitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          longitude: e.target.value,
                        }))
                      }
                      className="input"
                      placeholder="-74.0060"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="btn btn-secondary w-full"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Use Current Location
                </button>

                <div>
                  <label className="block text-sm font-medium text-night-300 mb-2">
                    Radius (meters)
                  </label>
                  <input
                    type="number"
                    value={formData.radius}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        radius: parseInt(e.target.value),
                      }))
                    }
                    className="input"
                    min="10"
                    max="5000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-night-300 mb-2">
                    Address (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, address: e.target.value }))
                    }
                    className="input"
                    placeholder="123 Main Street"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-night-300 mb-2">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="w-full h-10 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary flex-1">
                    {editingLocation ? 'Update' : 'Add'} Location
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaggedLocations;
