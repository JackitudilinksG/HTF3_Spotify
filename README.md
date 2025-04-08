# HackToFuture 3.0 Spotify Queue

A collaborative music queue system built for HackToFuture 3.0, allowing teams to add songs to a shared Spotify playlist with controlled playback.

## 🎵 Features

- **Team-Based Access**: Secure login system with team-specific codes
- **Spotify Integration**: Seamless connection with Spotify for music playback
- **Queue Management**: 
  - Add songs to the queue
  - View current queue
  - Remove songs (admin only)
  - Clear entire queue (admin only)
- **Playback Control**:
  - Automatic next track playback
  - Manual skip functionality
  - Device selection for playback
- **Admin Features**:
  - Exclusive playback control
  - Queue management capabilities
  - Device management
- **User Experience**:
  - Modern, responsive UI
  - Real-time queue updates
  - Terms and conditions acceptance
  - Session management

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Spotify Developer Account
- MongoDB Atlas account

### Environment Setup

1. Create a `.env.local` file in the root directory with the following variables:
```env
MONGODB_URI=your_mongodb_uri
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/spotify/callback
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/HTF3_Spotify.git
cd HTF3_Spotify
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🛠️ Tech Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: MongoDB
- **Authentication**: Custom team code system
- **Styling**: CSS-in-JS
- **API Integration**: Spotify Web API

## 📋 Usage Guide

### For Teams
1. Enter your team code to login
2. Connect your Spotify account
3. Search for songs and add them to the queue
4. View the current queue and track information

### For Admins
1. Login with admin credentials
2. Connect Spotify account
3. Control playback and manage the queue
4. Select playback device
5. Monitor and manage the music queue

## 🔒 Security Features

- Team-based authentication
- Admin-only controls
- Secure token management
- Session timeout
- Terms and conditions acceptance

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Spotify for their excellent API
- Next.js team for the amazing framework
- MongoDB for the database service
- All contributors and team members

## 📞 Support

For support, please contact the project maintainers or open an issue in the repository.

---

Made with ❤️ for HackToFuture 3.0
