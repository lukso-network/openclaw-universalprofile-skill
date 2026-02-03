import { validatePermissions, decodePermissions } from '../utils'
import { PERMISSION_DESCRIPTIONS, PERMISSION_RISK } from '../constants'

interface RiskWarningsProps {
  permissions: bigint
}

export function RiskWarnings({ permissions }: RiskWarningsProps) {
  const validation = validatePermissions(permissions)
  const decodedPermissions = decodePermissions(permissions.toString())
  
  // Get critical permissions
  const criticalPermissions = decodedPermissions.filter(
    p => PERMISSION_RISK[p] === 'critical'
  )
  
  // Get high-risk permissions
  const highRiskPermissions = decodedPermissions.filter(
    p => PERMISSION_RISK[p] === 'high'
  )

  // If no warnings or risks, show success message
  if (validation.risks.length === 0 && validation.warnings.length === 0) {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h4 className="font-medium text-green-700 dark:text-green-400">
              Low Risk Configuration
            </h4>
            <p className="text-sm text-green-600 dark:text-green-300 mt-1">
              The selected permissions have a low risk profile. This is a safe configuration.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Critical risks */}
      {criticalPermissions.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h4 className="font-bold text-red-700 dark:text-red-400">
                ⚠️ CRITICAL SECURITY WARNING
              </h4>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1 mb-3">
                You are about to grant extremely dangerous permissions. These could allow the controller to:
              </p>
              <ul className="space-y-2">
                {criticalPermissions.map(perm => (
                  <li key={perm} className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 font-bold">•</span>
                    <div>
                      <span className="font-semibold text-red-700 dark:text-red-400">{perm}:</span>
                      <span className="text-red-600 dark:text-red-300 ml-1">
                        {PERMISSION_DESCRIPTIONS[perm]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 rounded border border-red-300 dark:border-red-700">
                <p className="text-sm font-bold text-red-800 dark:text-red-300">
                  🚨 Only proceed if you completely trust this controller. Granting these permissions 
                  could result in PERMANENT LOSS of your Universal Profile and all assets.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* High risk warnings */}
      {highRiskPermissions.length > 0 && (
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold text-orange-700 dark:text-orange-400">
                High Risk Permissions
              </h4>
              <p className="text-sm text-orange-600 dark:text-orange-300 mt-1 mb-2">
                The following permissions require caution:
              </p>
              <ul className="space-y-1">
                {highRiskPermissions.map(perm => (
                  <li key={perm} className="flex items-start gap-2 text-sm">
                    <span className="text-orange-500">•</span>
                    <span className="text-orange-700 dark:text-orange-300">
                      <strong>{perm}:</strong> {PERMISSION_DESCRIPTIONS[perm]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* General warnings */}
      {validation.warnings.length > 0 && highRiskPermissions.length === 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-yellow-700 dark:text-yellow-400">
                Review Before Proceeding
              </h4>
              <ul className="mt-2 space-y-1">
                {validation.warnings.map((warning, i) => (
                  <li key={i} className="text-sm text-yellow-600 dark:text-yellow-300">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
