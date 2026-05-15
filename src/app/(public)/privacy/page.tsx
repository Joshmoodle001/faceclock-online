import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <a href="/" className="text-xl font-bold">FaceAttend</a>
        </div>
      </header>
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: January 2025</p>
          </CardHeader>
          <CardContent className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
              <h3 className="font-medium mt-4 mb-1">Biometric Data</h3>
              <p className="text-muted-foreground">
                We collect facial recognition data (face embeddings/templates) for the sole purpose of
                verifying identity during attendance clock-in/out events. Raw facial images are
                processed locally on your device and are not stored. Only mathematical
                representations (templates) are stored securely.
              </p>
              <h3 className="font-medium mt-4 mb-1">Location Data</h3>
              <p className="text-muted-foreground">
                We collect precise GPS location data when you perform clock events to verify you
                are within an authorized geofence. Location data is stored with each clock event
                and retained according to your organization&apos;s data retention policy.
              </p>
              <h3 className="font-medium mt-4 mb-1">Device Information</h3>
              <p className="text-muted-foreground">
                We collect device fingerprint, browser type, platform, and attestation information
                for security verification and fraud prevention.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. How We Use Your Data</h2>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Verify identity during attendance events using facial recognition</li>
                <li>Verify location compliance with organizational geofences</li>
                <li>Generate attendance records and payroll calculations</li>
                <li>Detect and prevent attendance fraud</li>
                <li>Comply with legal and regulatory obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Data Retention</h2>
              <p className="text-muted-foreground">
                Biometric templates are retained for the duration of your employment plus a period
                defined by your organization&apos;s policy (default 90 days post-termination).
                Attendance records are retained according to local labor law requirements.
                You may request deletion of your biometric data at any time by contacting your
                organization administrator.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Data Sharing</h2>
              <p className="text-muted-foreground">
                We do not sell your personal data. Biometric data is never shared with third parties
                except as required by law. Attendance data is accessible to authorized
                administrators within your organization.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures including encryption at rest and in
                transit, device attestation, and continuous security monitoring. Biometric templates
                are stored separately from other personal data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">6. Your Rights</h2>
              <p className="text-muted-foreground">
                Depending on your jurisdiction, you may have rights to access, correct, delete, or
                port your data. For GDPR (Europe), POPIA (South Africa), or other applicable laws,
                please contact your organization&apos;s data protection officer.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">7. Contact</h2>
              <p className="text-muted-foreground">
                For privacy-related inquiries, please contact your organization administrator or
                our data protection team at privacy@faceattend.com.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
