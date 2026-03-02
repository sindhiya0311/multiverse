import { useEffect, useState } from 'react';
import { useFamilyStore } from '../store/familyStore';
import { RiskMeter, StatusBadge, NightModeIndicator } from '../components';
import {
  UserPlus,
  Users,
  Mail,
  Check,
  X,
  Trash2,
  Clock,
  Settings,
  Loader2,
} from 'lucide-react';
import { formatRelativeTime } from '../utils/helpers';
import toast from 'react-hot-toast';

const Family = () => {
  const {
    familyMembers,
    pendingRequests,
    sentRequests,
    isLoading,
    fetchFamilyMembers,
    fetchPendingRequests,
    fetchSentRequests,
    sendRequest,
    respondToRequest,
    cancelRequest,
    removeMember,
  } = useFamilyStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('Family');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchFamilyMembers();
    fetchPendingRequests();
    fetchSentRequests();
  }, []);

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setIsSending(true);
    const result = await sendRequest(email, relationship);
    setIsSending(false);

    if (result.success) {
      toast.success('Request sent successfully');
      setShowAddModal(false);
      setEmail('');
      setRelationship('Family');
    } else {
      toast.error(result.message);
    }
  };

  const handleRespond = async (requestId, action) => {
    const result = await respondToRequest(requestId, action);
    if (result.success) {
      toast.success(`Request ${action}ed`);
    } else {
      toast.error(result.message);
    }
  };

  const handleCancel = async (requestId) => {
    const result = await cancelRequest(requestId);
    if (result.success) {
      toast.success('Request cancelled');
    }
  };

  const handleRemove = async (connectionId, memberName) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from your family?`)) {
      return;
    }

    const result = await removeMember(connectionId);
    if (result.success) {
      toast.success('Member removed');
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">
              Family Safety Network
            </h1>
            <p className="text-night-400 mt-1">
              Manage your connected family members
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Family Member
          </button>
        </div>

        {pendingRequests.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-noctis-400" />
              Pending Requests ({pendingRequests.length})
            </h2>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request._id}
                  className="flex items-center justify-between p-4 bg-night-800/50 rounded-lg border border-noctis-600/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-noctis-500 to-noctis-700 flex items-center justify-center text-white font-medium">
                      {request.requester?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {request.requester?.name}
                      </p>
                      <p className="text-sm text-night-400">
                        {request.requester?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRespond(request._id, 'accept')}
                      className="btn bg-green-600/20 hover:bg-green-600/30 text-green-400"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRespond(request._id, 'reject')}
                      className="btn bg-red-600/20 hover:bg-red-600/30 text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sentRequests.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Sent Requests ({sentRequests.length})
            </h2>
            <div className="space-y-3">
              {sentRequests.map((request) => (
                <div
                  key={request._id}
                  className="flex items-center justify-between p-4 bg-night-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-night-700 flex items-center justify-center text-night-300 font-medium">
                      {request.recipient?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {request.recipient?.name}
                      </p>
                      <p className="text-sm text-night-400">
                        {request.recipient?.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancel(request._id)}
                    className="btn btn-ghost text-night-400 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-400" />
            Family Members ({familyMembers.length})
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-noctis-400" />
            </div>
          ) : familyMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-night-600 mx-auto mb-4" />
              <p className="text-night-400">No family members yet</p>
              <p className="text-night-500 text-sm mt-1">
                Add family members to monitor their safety
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {familyMembers.map((member) => (
                <FamilyMemberCard
                  key={member.connectionId}
                  member={member}
                  onRemove={() =>
                    handleRemove(member.connectionId, member.member.name)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card w-full max-w-md">
              <h3 className="text-xl font-bold text-white mb-4">
                Add Family Member
              </h3>
              <form onSubmit={handleSendRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-night-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="family@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-night-300 mb-2">
                    Relationship
                  </label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="input"
                  >
                    <option value="Family">Family</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Friend">Friend</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Send Request
                      </>
                    )}
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

const FamilyMemberCard = ({ member, onRemove }) => {
  const { member: m, relationship, connectedAt } = member;

  return (
    <div className="p-4 bg-night-800/50 rounded-lg border border-night-700">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-noctis-500 to-noctis-700 flex items-center justify-center text-white font-medium text-lg">
              {m.name?.charAt(0).toUpperCase()}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-night-800 ${
                m.isOnline ? 'bg-green-500' : 'bg-night-600'
              }`}
            />
          </div>
          <div>
            <p className="font-semibold text-white">{m.name}</p>
            <p className="text-sm text-night-400">{relationship}</p>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-2 text-night-500 hover:text-red-400 hover:bg-night-700 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <StatusBadge status={m.currentStatus || 'Unknown'} className="text-xs" />
        {m.isNightModeActive && <NightModeIndicator isActive className="text-xs" />}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-night-700">
        <div>
          <p className="text-xs text-night-500">Risk Score</p>
          <p className="text-lg font-bold text-white">
            {m.currentRiskScore || 0}
          </p>
        </div>
        <RiskMeter score={m.currentRiskScore || 0} size="sm" showLabel={false} />
      </div>

      <div className="mt-3 pt-3 border-t border-night-700">
        <p className="text-xs text-night-500">
          {m.isOnline
            ? 'Currently online'
            : m.lastSeen
            ? `Last seen ${formatRelativeTime(m.lastSeen)}`
            : 'Never seen'}
        </p>
      </div>
    </div>
  );
};

export default Family;
