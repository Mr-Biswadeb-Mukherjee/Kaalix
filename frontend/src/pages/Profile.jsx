// Profile.jsx
import React, { useState, useEffect } from 'react';
import { useToast } from '../Components/Toast';
import Security from '../Components/Security';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import './Styles/Profile.css';
import API from '@amon/shared';

const Profile = () => {
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [userInfo, setUserInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    profileId: '',
    bio: ''
  });
  const [originalUserInfo, setOriginalUserInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    profileId: '',
    bio: ''
  });
  const [defaultCountry, setDefaultCountry] = useState('us'); // ISO code default
  const [location, setLocation] = useState('Unknown Location');
  const token = localStorage.getItem('token');

  const notify = {
    profileUpdated: () => addToast('Profile information updated successfully!', 'success'),
  };

  // Fetch profile on mount
  useEffect(() => {
    if (!token) return;

    fetch(API.system.protected.getprofile.endpoint, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then(data => {
        setUserInfo({
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || '',
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          profileId: data.profileId || '',
          bio: data.bio || ''
        });

        setOriginalUserInfo({
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          profileId: data.profileId || '',
          bio: data.bio || ''
        });
      })
      .catch(() => addToast('Failed to load profile info', 'error'));
  }, [token]);

  // Fetch location once and set default country
  useEffect(() => {
    if (!token) return;

    const countryISOMap = {
      'United States': 'us',
      India: 'in',
      'United Kingdom': 'gb',
      Australia: 'au',
      // Add more as needed
    };

    const fetchLocation = async () => {
      try {
        const res = await fetch(API.system.protected.status.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch location');
        const data = await res.json();
        const loc = data?.stats?.location || 'Unknown Location';
        setLocation(loc);

        if (countryISOMap[loc] && !phoneEdited) {
          setDefaultCountry(countryISOMap[loc]);
        }
      } catch {
        setLocation('Unknown Location');
      }
    };

    fetchLocation();
  }, [token, phoneEdited]);

  const hasChanges = Object.keys(originalUserInfo).some(
    key => originalUserInfo[key] !== userInfo[key]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setUserInfo({ ...originalUserInfo });
      setPhoneEdited(false);
    }
    setIsEditing(!isEditing);
  };

  const handleSave = () => {
    if (!hasChanges) return;

    fetch(API.system.protected.updateprofile.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        updatedAt: userInfo.updatedAt,
        fullName: userInfo.fullName,
        email: userInfo.email,
        phone: userInfo.phone,
        bio: userInfo.bio
      }),
    })
      .then(async res => {
        const data = await res.json();

        if (!res.ok) {
          addToast(data.message || 'Something went wrong', 'error');
          return;
        }

        notify.profileUpdated();

        // Use backend response directly
        const updatedUserInfo = {
          ...userInfo,
          updatedAt: data.updatedAt || userInfo.updatedAt, // take backend updatedAt
          fullName: data.fullName || userInfo.fullName,
          email: data.email || userInfo.email,
          phone: data.phone || userInfo.phone,
          bio: data.bio || userInfo.bio
        };

        setUserInfo(updatedUserInfo);
        setOriginalUserInfo(updatedUserInfo);
        setIsEditing(false);
        setPhoneEdited(false);
      })
      .catch(err => addToast(err.message || 'Failed to save changes', 'error'));
  };

  const getInitials = (name) => {
    if (!name) return 'NA';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="profile-container two-column-layout">
      {/* Left Column */}
      <div className="profile-left">
        <div className="profile-header-with-avatar">
          <div className="profile-avatar-placeholder">{getInitials(userInfo.fullName)}</div>
          <div className="profile-info">
            <h2>{userInfo.fullName}</h2>
            <p>{userInfo.email}</p>
            <p>Profile ID: {userInfo.profileId}</p>
          </div>
        </div>

        <div className="profile-section">
          <h3>Personal Information</h3>

          <div className="profile-item">
            <span>Name:</span>
            {isEditing ? (
              <input
                type="text"
                name="fullName"
                value={userInfo.fullName}
                onChange={handleChange}
              />
            ) : (
              <p>{userInfo.fullName}</p>
            )}
          </div>

          <div className="profile-item">
            <span>Email:</span>
            {isEditing ? (
              <input
                type="email"
                name="email"
                value={userInfo.email}
                onChange={handleChange}
              />
            ) : (
              <p>{userInfo.email}</p>
            )}
          </div>

          <div className="profile-item">
            <span>Phone:</span>
            {isEditing ? (
            <PhoneInput
              country={defaultCountry}
              value={userInfo.phone}
              onChange={(value) => {
                setUserInfo(prev => ({ ...prev, phone: value.startsWith('+') ? value : `+${value}` }));
                setPhoneEdited(true);
              }}
              enableSearch
              placeholder="Enter phone number"
              containerClass="phone-input-container"
              inputClass="phone-input-field"
              buttonClass="phone-input-flag"
            />
            ) : (
              <p>{userInfo.phone}</p>
            )}
          </div>

          <div className="profile-item">
            <span>Bio:</span>
            {isEditing ? (
              <textarea
                name="bio"
                value={userInfo.bio}
                onChange={handleChange}
                placeholder="Tell us something about yourself..."
                rows={4}
                style={{ width: '100%' }}
              />
            ) : (
              <div className="bio-display">
                <p>{userInfo.bio || 'No bio available'}</p>
              </div>
            )}
          </div>

          <div className="profile-actions">
            {!isEditing && <button className="edit-btn" onClick={handleEditToggle}>Edit</button>}
            {isEditing && (
              <>
                <button className="edit-btn cancel-btn" onClick={handleEditToggle}>Cancel</button>
                <button className="edit-btn save-btn" onClick={handleSave} disabled={!hasChanges}>
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>

        <Security useremail={userInfo.email} />
      </div>

      {/* Right Column */}
      <div className="profile-right">
        <div className="widget-card">
          <h3>Recent Activity</h3>
          <ul>
            <li>Logged in from {location}</li>
          </ul>
        </div>

        <div className="widget-card">
          <h3>Account Status</h3>
          <h4>Created-At: {userInfo.createdAt}</h4>
          <h4>Updated-At: {userInfo.updatedAt}</h4>
          <h4>Last login: Today</h4>
        </div>
      </div>
    </div>
  );

};

export default Profile;
