import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getRiskColor } from '../utils/helpers';
import 'leaflet/dist/leaflet.css';

const userIcon = (color = '#6366f1') =>
  L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const familyIcon = (color = '#10b981', isOnline = true) =>
  L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background: ${isOnline ? color : '#64748b'};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        ${isOnline ? '' : 'opacity: 0.6;'}
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

const taggedIcon = (color = '#3b82f6') =>
  L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 16px;
        height: 16px;
        background: ${color};
        border: 2px solid white;
        border-radius: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      "></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const MapController = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  return null;
};

const LiveMap = ({
  center,
  zoom = 15,
  currentLocation,
  familyMembers = [],
  taggedLocations = [],
  riskScore = 0,
  showTaggedRadii = true,
  className = '',
}) => {
  const mapCenter = useMemo(() => {
    if (currentLocation?.latitude && currentLocation?.longitude) {
      return [currentLocation.latitude, currentLocation.longitude];
    }
    if (center) return center;
    return [40.7128, -74.006];
  }, [currentLocation, center]);

  const userColor = getRiskColor(riskScore);

  return (
    <MapContainer
      center={mapCenter}
      zoom={zoom}
      className={`w-full h-full rounded-xl ${className}`}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <MapController center={mapCenter} zoom={zoom} />

      {taggedLocations.map((location) => (
        <div key={location._id}>
          {showTaggedRadii && (
            <Circle
              center={[location.latitude, location.longitude]}
              radius={location.radius}
              pathOptions={{
                color: location.color || '#3b82f6',
                fillColor: location.color || '#3b82f6',
                fillOpacity: 0.1,
                weight: 1,
              }}
            />
          )}
          <Marker
            position={[location.latitude, location.longitude]}
            icon={taggedIcon(location.color)}
          >
            <Popup>
              <div className="text-night-900">
                <strong>{location.label}</strong>
                <br />
                <span className="text-xs capitalize">{location.type}</span>
              </div>
            </Popup>
          </Marker>
        </div>
      ))}

      {familyMembers.map((member) => {
        if (!member.member?.lastKnownLocation?.latitude) return null;
        const loc = member.member.lastKnownLocation;
        const color = getRiskColor(member.member.currentRiskScore || 0);

        return (
          <Marker
            key={member.member.id}
            position={[loc.latitude, loc.longitude]}
            icon={familyIcon(color, member.member.isOnline)}
          >
            <Popup>
              <div className="text-night-900">
                <strong>{member.member.name}</strong>
                <br />
                <span className="text-xs">
                  {member.member.currentStatus || 'Unknown'}
                </span>
                <br />
                <span className="text-xs">
                  Risk: {member.member.currentRiskScore || 0}
                </span>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {currentLocation?.latitude && currentLocation?.longitude && (
        <>
          <Circle
            center={[currentLocation.latitude, currentLocation.longitude]}
            radius={currentLocation.accuracy || 50}
            pathOptions={{
              color: userColor,
              fillColor: userColor,
              fillOpacity: 0.15,
              weight: 1,
            }}
          />
          <Marker
            position={[currentLocation.latitude, currentLocation.longitude]}
            icon={userIcon(userColor)}
          >
            <Popup>
              <div className="text-night-900">
                <strong>You are here</strong>
                <br />
                <span className="text-xs">Risk Score: {riskScore}</span>
              </div>
            </Popup>
          </Marker>
        </>
      )}
    </MapContainer>
  );
};

export default LiveMap;
