import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full bg-gray-950/80 backdrop-blur-md border-t border-gray-800 text-gray-400 py-6 text-center text-sm z-10 relative mt-auto">
      <div className="max-w-7xl mx-auto px-4">
        <p>&copy; {new Date().getFullYear()} Rent & Flatmate. All rights reserved.</p>
        <p className="mt-1 text-gray-500">Find your perfect match. Built with AI.</p>
      </div>
    </footer>
  );
}
