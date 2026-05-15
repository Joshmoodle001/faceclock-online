import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsPage() {
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
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: January 2025</p>
          </CardHeader>
          <CardContent className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using FaceAttend, you agree to be bound by these Terms of Service.
                If you do not agree, do not use the service.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">2. Description of Service</h2>
              <p className="text-muted-foreground">
                FaceAttend provides facial recognition-based attendance tracking, geo-fencing,
                time management, and payroll calculation services for organizations and their
                employees.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">3. User Responsibilities</h2>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Provide accurate personal information</li>
                <li>Maintain confidentiality of account credentials</li>
                <li>Use the service only for legitimate attendance tracking</li>
                <li>Not attempt to circumvent security measures or falsify attendance</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">4. Biometric Consent</h2>
              <p className="text-muted-foreground">
                By using FaceAttend, you consent to the collection and processing of your facial
                biometric data for identity verification during attendance events. You may withdraw
                consent by contacting your organization administrator, which may affect your
                ability to use the service.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">5. Data Accuracy</h2>
              <p className="text-muted-foreground">
                While we strive for accuracy, FaceAttend is not liable for errors in attendance
                records. Users should verify their attendance records and report discrepancies
                to their administrator promptly.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">6. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                FaceAttend shall not be liable for indirect, incidental, or consequential damages
                arising from the use or inability to use the service, including but not limited to
                payroll errors, lost wages, or disciplinary actions based on attendance records.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">7. Termination</h2>
              <p className="text-muted-foreground">
                Organizations may terminate access at any time. Users may request account deletion
                through their organization administrator. Upon termination, data will be handled
                according to the applicable data retention policy.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-2">8. Governing Law</h2>
              <p className="text-muted-foreground">
                These terms are governed by the laws of the Republic of South Africa. Any disputes
                shall be resolved in the courts of Johannesburg, South Africa.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
